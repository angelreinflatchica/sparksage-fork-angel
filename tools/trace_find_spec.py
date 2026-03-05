import builtins
import importlib.util
import traceback
from collections import deque

opened = deque(maxlen=50)
orig_open = builtins.open

def my_open(file, *args, **kwargs):
    try:
        opened.append(file)
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
    for f in list(opened)[-20:]:
        print(f)
finally:
    builtins.open = orig_open
