import { exec } from 'child_process';
import fs from 'fs';

console.log("Starting localtunnel on port 3000...");
const lt = exec('npx --yes localtunnel --port 3000');

lt.stdout.on('data', (data) => {
  process.stdout.write(data.toString());
  const match = data.toString().match(/your url is: (https:\/\/[^\s]+)/);
  if (match) {
    const url = match[1];
    console.log("\nTunnel URL:", url);
    const host = url.replace('https://', '');
    
    // Update the connector JSON
    const jsonPath = 'lee-broker-tool-connector.json';
    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    json.host = host;
    json.schemes = ["https"];
    fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));
    console.log("\nSuccessfully updated lee-broker-tool-connector.json with new host:", host);
    console.log("The tunnel is now running. Keep this process alive to maintain the connection.");
  }
});

lt.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

lt.on('close', (code) => {
  console.log(`localtunnel process exited with code ${code}`);
});
