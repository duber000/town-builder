---
description: Check Redis connection and status
---

Check the Redis connection and view multiplayer state.

Commands to run:

1. Test Redis connection:
   ```bash
   redis-cli ping
   ```

2. Check Redis info:
   ```bash
   redis-cli info
   ```

3. Monitor Redis activity (real-time):
   ```bash
   redis-cli monitor
   ```

4. List all keys (debugging):
   ```bash
   redis-cli keys '*'
   ```

5. View specific town data:
   ```bash
   redis-cli get "town:<town_id>"
   ```

Note: Redis is required for multiplayer functionality and state sharing between app instances.
