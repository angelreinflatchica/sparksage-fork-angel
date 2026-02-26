import builtins
import importlib.util
import traceback
from collections import deque
from pathlib import Path
import sys

# ensure project root is first
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

opened = deque(maxlen=200)
orig_open = builtins.open

def my_open(file, *args, **kwargs):
    try:
        opened.append(str(file))
    except Exception:
        pass
    return orig_open(file, *args, **kwargs)

builtins.open = my_open

try:
    spec = importlib.util.find_spec('plugins.trivia.trivia_cog')
    print('SPEC', spec)
except Exception:
    traceback.print_exc()
    print('\nLast opened files:')
    for f in list(opened)[-50:]:
        print(f)
finally:
    builtins.open = orig_open
