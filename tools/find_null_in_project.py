from pathlib import Path
import binascii
root = Path(__file__).resolve().parents[1]
print('Scanning', root)
for p in root.rglob('*.py'):
    try:
        b = p.read_bytes()
    except Exception as e:
        print('ERR', p, e)
        continue
    if b.count(b'\x00')>0:
        print('NULLS IN', p, 'count', b.count(b'\x00'))
        print('HEX', binascii.hexlify(b[:200]))
        break
else:
    print('No null bytes found in .py files')
