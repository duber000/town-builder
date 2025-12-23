---
description: Check and verify project dependencies
---

Check the status of project dependencies and requirements.

Run these commands to verify your setup:

1. Check Python version (requires 3.14+):
   ```bash
   python --version
   ```

2. Check Go version (requires 1.24+):
   ```bash
   go version
   ```

3. Check Redis status:
   ```bash
   redis-cli ping
   ```

4. List Python dependencies:
   ```bash
   uv pip list
   ```

5. Verify environment variables:
   ```bash
   cat .env
   ```
