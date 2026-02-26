import sys
from pathlib import Path
import binascii

print('PYTHON', sys.executable)
for p in sys.path:
    try:
        path = Path(p)
    except Exception:
        continue
    if not path.exists():
        continue
    # Only inspect directories
    if path.is_dir():
        for root, dirs, files in __import__('os').walk(path):
            for f in files:
                if f.endswith('.py'):
                    fp = Path(root) / f
                    try:
                        b = fp.read_bytes()
                        if b.count(b'\x00')>0:
                            print('NULL IN', fp)
                            print('  COUNT', b.count(b'\x00'))
                            print('  HEX', binascii.hexlify(b[:64]))
                            raise SystemExit(0)
                    except Exception as e:
                        # Report read errors
                        print('ERR READ', fp, e)
    else:
        # if it's a file (zip,egg), skip
        pass
print('DONE')
