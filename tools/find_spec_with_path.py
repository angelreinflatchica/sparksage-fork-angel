import sys
print('CWD', sys.path[0])
print('sys.path entries:')
for p in sys.path:
    print(' -', p)

import importlib.util
try:
    spec = importlib.util.find_spec('plugins.trivia.trivia_cog')
    print('SPEC', spec)
except Exception as e:
    import traceback
    traceback.print_exc()
