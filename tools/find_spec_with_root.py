import sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
print('Adding root to sys.path:', root)
sys.path.insert(0, str(root))
print('sys.path[0]=', sys.path[0])
import importlib.util
import traceback
try:
    spec = importlib.util.find_spec('plugins.trivia.trivia_cog')
    print('SPEC', spec)
except Exception:
    traceback.print_exc()
    print('\n--- Now trying to import to get full traceback ---')
    try:
        import importlib
        importlib.import_module('plugins.trivia.trivia_cog')
    except Exception:
        traceback.print_exc()
