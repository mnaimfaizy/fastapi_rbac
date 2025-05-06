"""
Root conftest.py to help pytest discover the app module.
This file adds the current directory to the Python path.
"""

import os
import sys

# Add the project root directory to Python's path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
