import sys
import os

print(f"Current working directory: {os.getcwd()}")
print("
Python System Path (sys.path):")
for path in sys.path:
    print(path)
