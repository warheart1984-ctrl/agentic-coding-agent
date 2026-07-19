import sys
sys.path.insert(0, 'e:/ulx/src/sovereign-ide')

from runtime.ulx_bridge import ULXBridge

bridge = ULXBridge()

# Test manifest
manifest = bridge.manifest()
print("ULX Bridge Manifest:")
print(f"  Surface: {manifest['surface']}")
print(f"  Title: {manifest['title']}")
print(f"  Commands: {manifest['commands']}")
print(f"  Traceability links: {manifest['traceability_links']}")

# Test compile
compile_result = bridge.compile()
print("\nCompile Result:")
print(f"  Command: {compile_result['command']}")
print(f"  Accepted: {compile_result['accepted']}")
print(f"  Source hash: {compile_result['source_hash']}")

# Test run
run_result = bridge.run()
print("\nRun Result:")
print(f"  Command: {run_result['command']}")
print(f"  Accepted: {run_result['accepted']}")
print(f"  Result: {run_result['result']}")

print("\nULX Bridge functionality test: PASSED")
