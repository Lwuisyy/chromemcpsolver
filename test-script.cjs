
const { spawn } = require("child_process");

const mcpServer = spawn("node", ["build/src/bin/chrome-devtools-mcp.js", "--headless"], {
  stdio: ["pipe", "pipe", "pipe"]
});

let isReady = false;

mcpServer.stdout.on("data", (data) => {
  const str = data.toString();
  // MCP protocol uses JSON RPC over stdout
  if (str.includes("\"jsonrpc\"")) {
    console.log("Server responded:", str);
  }
});

mcpServer.stderr.on("data", (data) => {
  const str = data.toString();
  console.log("[stderr]", str);
  if (!isReady && str.includes("chrome-devtools-mcp exposes")) {
    isReady = true;
    runTests();
  }
});

function sendRequest(method, params = {}) {
  const req = {
    jsonrpc: "2.0",
    id: 1,
    method,
    params
  };
  mcpServer.stdin.write(JSON.stringify(req) + "\n");
}

function runTests() {
  console.log("Sending list_tools request...");
  // 1. Initialize MCP connection
  sendRequest("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" }
  });

  // Then ask for tools
  setTimeout(() => {
    sendRequest("tools/list", {});
  }, 1000);
  
  // Cleanup
  setTimeout(() => {
    mcpServer.kill();
    process.exit(0);
  }, 3000);
}
