from __future__ import annotations

import time
from openai import OpenAI
import config


def _create_client(provider_name: str) -> OpenAI | None:
    """Create an OpenAI-compatible client for the given provider."""
    provider = config.PROVIDERS.get(provider_name)
    if not provider or not provider.get("api_key") or not provider["api_key"].strip(): # Check for None or empty string
        return None

    extra_headers = {}
    if provider_name == "anthropic":
        extra_headers["anthropic-version"] = "2023-06-01"
    elif provider_name == "openrouter":
        extra_headers["HTTP-Referer"] = "https://github.com/google/gemini-cli"
        extra_headers["X-Title"] = "SparkSage Bot"

    try: # Added try-except block
        return OpenAI(
            base_url=provider["base_url"],
            api_key=provider["api_key"],
            default_headers=extra_headers or None,
        )
    except Exception as e:
        print(f"ERROR: Failed to create OpenAI client for {provider_name}: {e}")
        return None


def _build_fallback_order() -> list[str]:
    """Build the provider fallback order: primary first, then free providers."""
    primary = config.AI_PROVIDER
    order = [primary]
    for name in config.FREE_FALLBACK_CHAIN:
        if name not in order:
            order.append(name)
    return order


def _build_clients() -> dict[str, OpenAI]:
    """Build clients for all configured providers."""
    clients = {}
    for name in set([config.AI_PROVIDER] + config.FREE_FALLBACK_CHAIN + list(config.PROVIDERS.keys())):
        try:
            client = _create_client(name)
            if client:
                clients[name] = client
        except Exception as e:
            print(f"ERROR: Failed to build client for {name} during module load: {e}")
    return clients


# Pre-build clients for all configured providers
_clients: dict[str, OpenAI] = _build_clients()
FALLBACK_ORDER = _build_fallback_order()


def reload_clients():
    """Rebuild all clients and fallback order from current config."""
    global _clients, FALLBACK_ORDER
    _clients = _build_clients()
    FALLBACK_ORDER = _build_fallback_order()


def get_available_providers() -> list[str]:
    """Return list of provider names that have valid API keys configured."""
    return [name for name in FALLBACK_ORDER if name in _clients]


async def test_provider(name: str, api_key: str | None = None) -> dict:
    """Test a provider with a minimal API call. Returns {success, message, latency_ms}.
    
    If api_key is provided, it tests that specific key instead of the saved one.
    """
    provider_info = config.PROVIDERS.get(name)
    if not provider_info:
        return {"success": False, "latency_ms": 0, "message": f"Unknown provider: {name}"}

    client = None # Initialize client to None
    # If a specific key is provided (e.g. from the wizard), create a temporary client
    if api_key:
        extra_headers = {}
        if name == "anthropic":
            extra_headers["anthropic-version"] = "2023-06-01"
        elif name == "openrouter":
            extra_headers["HTTP-Referer"] = "https://github.com/google/gemini-cli"
            extra_headers["X-Title"] = "SparkSage Bot"
            
        client = OpenAI(
            base_url=provider_info["base_url"],
            api_key=api_key,
            default_headers=extra_headers or None,
        )
    else:
        client = _clients.get(name)
        if not client:
            # Try creating a fresh client in case config was just updated
            client = _create_client(name)
            if not client:
                return {"success": False, "latency_ms": 0, "message": "No API key configured"}
    
    # Ensure client was successfully created/retrieved before proceeding
    if not client:
        return {"success": False, "latency_ms": 0, "message": "Failed to initialize provider client"}

    start = time.time()
    try:
        response = client.chat.completions.create(
            model=provider_info["model"],
            max_tokens=10,
            messages=[{"role": "user", "content": "Hi"}],
        )
        latency = int((time.time() - start) * 1000)
        return {"success": True, "latency_ms": latency, "message": "Connection successful"}
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        # Extract a cleaner error message if possible
        error_msg = str(e)
        if "api_key" in error_msg.lower() or "invalid_api_key" in error_msg.lower():
            error_msg = "Invalid API key"
        elif "connection" in error_msg.lower():
            error_msg = "Connection failed"

        return {"success": False, "latency_ms": latency, "message": error_msg}
def chat(messages: list[dict], system_prompt: str, override_primary: str | None = None) -> tuple[str, str, int, int]:
    """Send messages to AI and return (response_text, provider_name, tokens_used, latency_ms).

    Tries the primary provider first (or override if provided), then falls back through free providers.
    Raises RuntimeError if all providers fail.
    """
    errors = []
    
    # Build fallback order for this specific request
    current_order = FALLBACK_ORDER.copy()
    if override_primary and override_primary in _clients:
        if override_primary in current_order:
            current_order.remove(override_primary)
        current_order.insert(0, override_primary)

    for provider_name in current_order:
        client = _clients.get(provider_name)
        if not client:
            continue

        provider = config.PROVIDERS[provider_name]
        start_time = time.time()
        try:
            response = client.chat.completions.create(
                model=provider["model"],
                max_tokens=config.MAX_TOKENS,
                messages=[
                    {"role": "system", "content": system_prompt},
                    *messages,
                ],
            )
            print(f"--- Provider: {provider_name}, Response usage: {getattr(response, 'usage', 'N/A')} ---")
            latency = int((time.time() - start_time) * 1000)
            text = response.choices[0].message.content
            
            # OpenAI SDK provides usage
            input_tokens = response.usage.prompt_tokens if hasattr(response, "usage") and response.usage else 0
            output_tokens = response.usage.completion_tokens if hasattr(response, "usage") and response.usage else 0
            
            estimated_cost = calculate_cost(provider_name, input_tokens, output_tokens)
            
            return text, provider_name, input_tokens, output_tokens, estimated_cost, latency

        except Exception as e:
            errors.append(f"{provider['name']}: {e}")
            continue

    error_details = "\n".join(errors)
    raise RuntimeError(f"All providers failed:\n{error_details}")


def calculate_cost(provider_name: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate the estimated cost for a given provider and token usage."""
    provider_info = config.PROVIDERS.get(provider_name)
    if not provider_info or provider_info.get("free"):
        return 0.0

    input_cost = (input_tokens / 1_000_000) * provider_info.get("input_cost_per_million_tokens", 0.0)
    output_cost = (output_tokens / 1_000_000) * provider_info.get("output_cost_per_million_tokens", 0.0)
    
    return input_cost + output_cost

