import subprocess
import json
import time

def test_docker_mcp_server_initialization():
    """
    Test that the Docker container can be run and that the MCP server
    responds correctly to an initialization request over stdio.
    """
    # Start the Docker container interactively
    process = subprocess.Popen(
        [
            "docker", "run", "-i", "--rm", 
            # We don't necessarily need to mount volumes just for the initialization test
            # but we could if we wanted to test specific tools.
            "connect-mcp"
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    init_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }
    }

    # Send the initialization request
    process.stdin.write(json.dumps(init_request) + "\n")
    process.stdin.flush()

    # Read the response
    # We expect a JSON-RPC response on stdout
    # Sometimes there might be warning logs, so we read lines until we find a valid JSON object
    
    response_json = None
    # Add a simple timeout to avoid hanging indefinitely
    import threading
    
    def read_stdout():
        nonlocal response_json
        for line in process.stdout:
            try:
                data = json.loads(line)
                if "jsonrpc" in data and data.get("id") == 1:
                    response_json = data
                    break
            except json.JSONDecodeError:
                pass

    reader_thread = threading.Thread(target=read_stdout)
    reader_thread.start()
    reader_thread.join(timeout=10) # 10 seconds timeout

    # Terminate the container
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()

    assert response_json is not None, "Failed to get a valid JSON-RPC response from the container within the timeout."
    
    # Assert successful initialization response
    assert "result" in response_json, f"Error in response: {response_json.get('error')}"
    assert "serverInfo" in response_json["result"]
    assert response_json["result"]["serverInfo"]["name"] == "connect-mcp-server"
