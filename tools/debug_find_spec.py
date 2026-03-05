import sys
import importlib.util
from importlib.machinery import PathFinder

name='plugins.trivia.trivia_cog'
print('META_PATH:')
for i,f in enumerate(sys.meta_path):
    print(i,type(f))
    try:
        spec=f.find_spec(name)
        print('  spec from meta',i, spec)
    except Exception as e:
        print('  ERROR from finder', i, type(f), e)

print('\nPATH FINDER SEARCH:')
for p in sys.path:
    try:
        spec=PathFinder.find_spec(name, [p])
        print('path', p, '=>', spec)
    except Exception as e:
        print('path', p, 'ERROR', e)
