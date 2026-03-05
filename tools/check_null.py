from pathlib import Path
import binascii
p = Path('plugins/trivia/trivia_cog.py')
if not p.exists():
    print('MISSING')
else:
    b = p.read_bytes()
    print('LEN', len(b))
    print('NULLS', b.count(b'\x00'))
    if b.count(b'\x00') > 0:
        print('FIRST100', binascii.hexlify(b[:100]))
