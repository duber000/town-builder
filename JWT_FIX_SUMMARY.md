# JWT Authentication Fix - Summary

## Problem
The town-builder service was experiencing authentication failures when communicating with the iribala Django API after 15 minutes due to JWT access token expiration.

## Solution Implemented
Implemented **DRF Token Authentication** (Option 2 from TODO_JWT.md) for service-to-service communication. This is the recommended approach for internal microservices.

## Changes Made

### 1. Django Backend (`django_project/settings.py`)
- Added `rest_framework.authtoken` to `INSTALLED_APPS`
- Added `TokenAuthentication` to `DEFAULT_AUTHENTICATION_CLASSES` (placed first in the list for priority)
- JWT authentication remains available for user-facing APIs

### 2. Town-Builder Client Code
Updated authorization header format from `Bearer` to `Token`:
- `external/app/services/django_client.py:71` - `_get_headers()` function
- `external/app/services/django_client.py:236` - `proxy_request()` function
- `external/app/routes/town.py:288` - `load_town_from_django()` function

### 3. Database Migration
Ran Django migrations to create authtoken tables:
```bash
uv run python manage.py migrate
```

### 4. Token Generation
Generated DRF token for user 'tivon':
```
Token: <REDACTED_FOR_SECURITY>
```
Note: Actual token stored in Kubernetes secret `town-builder-secrets` in namespace `town-builder`

### 5. Kubernetes Secret Update
Updated the town-builder secret with the new token:
```bash
kubectl -n town-builder patch secret town-builder-secrets \
  -p '{"stringData":{"TOWN_API_JWT_TOKEN":"<YOUR_ACTUAL_TOKEN_HERE>"}}'
```

### 6. Deployment Restart
Restarted town-builder to pick up the new configuration:
```bash
kubectl -n town-builder rollout restart deployment town-builder
```

## Benefits
✅ **No expiration** - DRF tokens don't expire by default
✅ **Simple** - No refresh token logic needed
✅ **Secure** - Appropriate for internal Kubernetes service-to-service communication
✅ **Backward compatible** - JWT authentication still works for user-facing APIs

## Authentication Flow
1. Town-builder sends request with header: `Authorization: Token <token>`
2. Django tries TokenAuthentication first (no expiration check)
3. Falls back to JWT authentication if Token auth fails (for user requests)

## Token Management

### View Current Token
```bash
uv run python manage.py shell -c "
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.get(username='tivon')
token = Token.objects.get(user=user)
print(f'Token: {token.key}')
"
```

### Regenerate Token (if compromised)
```bash
uv run python manage.py shell -c "
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.get(username='tivon')
Token.objects.filter(user=user).delete()
token = Token.objects.create(user=user)
print(f'New Token: {token.key}')
"
```

Then update the Kubernetes secret:
```bash
kubectl -n town-builder patch secret town-builder-secrets \
  -p '{"stringData":{"TOWN_API_JWT_TOKEN":"<new-token>"}}'
kubectl -n town-builder rollout restart deployment town-builder
```

## Testing
The town-builder service should now be able to communicate with the Django API indefinitely without token expiration errors.

Monitor logs for any authentication issues:
```bash
kubectl -n town-builder logs -f -l app=town-builder | grep -E "(ERROR|Auth|401)"
```

## Next Steps (Optional Long-Term Improvements)
- Consider creating a dedicated service account user (e.g., 'town-builder-service') instead of using a personal account
- Implement mTLS for additional security (Option 5 from TODO_JWT.md)
- Set up token rotation policy if required by security team

## Rollback Instructions
If you need to rollback to JWT authentication:

1. Revert the code changes in:
   - `django_project/settings.py` (remove TokenAuthentication)
   - `external/app/services/django_client.py` (change Token back to Bearer)
   - `external/app/routes/town.py` (change Token back to Bearer)

2. Generate a new JWT token and update the secret

3. Restart the deployment
