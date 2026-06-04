#!/usr/bin/env python3
"""Stage broker_tool.html/css/features_patch.js to S3 and pull onto the prod EC2 instance via SSM."""
import json, pathlib, shlex, subprocess, sys, time

REGION = "us-east-2"
INSTANCE = "i-08039bb98933ea13b"
BUCKET = "lee-broker-tool-artifacts-867958226961-us-east-2"
KEY_PREFIX = "hot-patch"


def run(cmd: list[str]) -> str:
    out = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return out.stdout.strip()


def presign(key: str) -> str:
    return run(["aws", "s3", "presign", f"s3://{BUCKET}/{key}", "--region", REGION, "--expires-in", "900"])


def main():
    # Always refresh S3 objects with the latest local content
    run(["aws", "s3", "cp", "client/public/broker_tool.html",    f"s3://{BUCKET}/{KEY_PREFIX}/broker_tool.html",    "--region", REGION])
    run(["aws", "s3", "cp", "client/public/broker_tool.css",     f"s3://{BUCKET}/{KEY_PREFIX}/broker_tool.css",     "--region", REGION])
    run(["aws", "s3", "cp", "client/public/features_patch.js",   f"s3://{BUCKET}/{KEY_PREFIX}/features_patch.js",   "--region", REGION])
    html_url  = presign(f"{KEY_PREFIX}/broker_tool.html")
    css_url   = presign(f"{KEY_PREFIX}/broker_tool.css")
    patch_url = presign(f"{KEY_PREFIX}/features_patch.js")
    cmds = [
        "set -e",
        f"curl -fsSL -o /opt/lee-broker-tool/dist/public/broker_tool.html {shlex.quote(html_url)}",
        f"curl -fsSL -o /opt/lee-broker-tool/dist/public/broker_tool.css {shlex.quote(css_url)}",
        f"curl -fsSL -o /opt/lee-broker-tool/dist/public/features_patch.js {shlex.quote(patch_url)}",
        "chown root:root /opt/lee-broker-tool/dist/public/broker_tool.html /opt/lee-broker-tool/dist/public/broker_tool.css /opt/lee-broker-tool/dist/public/features_patch.js",
        "chmod 644 /opt/lee-broker-tool/dist/public/broker_tool.html /opt/lee-broker-tool/dist/public/broker_tool.css /opt/lee-broker-tool/dist/public/features_patch.js",
        "systemctl restart lee-broker-tool",
        "sleep 2",
        "systemctl is-active lee-broker-tool",
        "md5sum /opt/lee-broker-tool/dist/public/broker_tool.html /opt/lee-broker-tool/dist/public/broker_tool.css /opt/lee-broker-tool/dist/public/features_patch.js",
        "wc -c /opt/lee-broker-tool/dist/public/broker_tool.html /opt/lee-broker-tool/dist/public/broker_tool.css /opt/lee-broker-tool/dist/public/features_patch.js",
        "echo __DONE__",
    ]
    params = {"commands": cmds}
    payload_path = pathlib.Path("/tmp/hot-patch.json")
    payload_path.write_text(json.dumps(params))

    cmd_id = run([
        "aws", "ssm", "send-command",
        "--region", REGION,
        "--instance-ids", INSTANCE,
        "--document-name", "AWS-RunShellScript",
        "--comment", "hot-patch broker_tool assets",
        "--parameters", f"file://{payload_path}",
        "--query", "Command.CommandId",
        "--output", "text",
    ])
    print(f"CMDID={cmd_id}")
    for attempt in range(12):
        time.sleep(4)
        result = subprocess.run([
            "aws", "ssm", "get-command-invocation",
            "--region", REGION, "--instance-id", INSTANCE, "--command-id", cmd_id,
            "--query", "[Status,StandardOutputContent,StandardErrorContent]", "--output", "text",
        ], capture_output=True, text=True)
        out = result.stdout
        if not out.startswith("InProgress"):
            print(out)
            if "Success" not in out.splitlines()[0]:
                sys.exit(1)
            return
    print("TIMEOUT waiting for SSM")
    sys.exit(2)


if __name__ == "__main__":
    main()
