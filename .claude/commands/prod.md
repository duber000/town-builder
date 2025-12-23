---
description: Start production server with Gunicorn
---

Start the Town Builder application in production mode using Gunicorn with gevent workers.

Run: `gunicorn -w 4 -k gevent -b 0.0.0.0:5000 app.main:app`

The application will be available at http://127.0.0.1:5000/

Notes:
- Uses port 5000 (matches Kubernetes deployment)
- 4 worker processes
- Gevent for async support (required for SSE)
- Ensure Redis is running for multiplayer features
- Check that .env is configured for production
