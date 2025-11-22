# JWT Token Authentication Issue

## Problem

The JWT access token used for service-to-service communication between town-builder and Django expires after **15 minutes**. This causes authentication failures when making API calls to Django after the token expires.

### Current Status
- **Token Type**: JWT Access Token (djangorestframework-simplejwt)
- **Lifetime**: 15 minutes
- **Last Generated**: 2025-11-22 02:04:20
- **Expired**: 2025-11-22 02:19:20
- **Django Settings**:
  - `ACCESS_TOKEN_LIFETIME`: 15 minutes
  - `REFRESH_TOKEN_LIFETIME`: 7 days

### Error When Token Expires
```
ERROR:app.routes.town:Error loading town from Django: 401 Client Error: Unauthorized for url: http://iribala-django.iribala-django.svc.cluster.local:8000/api/towns/1/
```

## Possible Solutions

### Option 1: Use Refresh Token (Quick Fix)
**Complexity**: Medium | **Recommended for**: Temporary solution

Generate a refresh token alongside the access token and implement token refresh logic in town-builder.

**Pros**:
- Follows JWT best practices
- Refresh tokens last 7 days
- Can get new access tokens automatically

**Cons**:
- Requires implementing refresh logic in town-builder
- Refresh token also expires (after 7 days)
- More complex than other options

**Implementation**:
```python
# Generate both tokens in Django
from rest_framework_simplejwt.tokens import RefreshToken
refresh = RefreshToken.for_user(user)
access_token = str(refresh.access_token)
refresh_token = str(refresh)

# Store both in Kubernetes secret:
# TOWN_API_JWT_TOKEN = access_token
# TOWN_API_JWT_REFRESH_TOKEN = refresh_token
```

Then implement refresh logic in `app/services/django_client.py` to automatically get new access tokens when they expire.

---

### Option 2: Django Rest Framework Token Authentication (Simplest)
**Complexity**: Low | **Recommended for**: Service-to-service auth

Use DRF's built-in Token Authentication instead of JWT. These tokens don't expire by default.

**Pros**:
- Tokens never expire (unless manually revoked)
- Simpler implementation
- Built into Django Rest Framework
- Perfect for service accounts

**Cons**:
- Tokens stored in database
- No automatic expiration (security consideration)
- Need to manually revoke if compromised

**Implementation**:
```python
# 1. In Django, ensure Token authentication is enabled
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',  # Add this
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ]
}

# 2. Generate token for service account
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.get(username='tivon')
token, created = Token.objects.get_or_create(user=user)
print(f'Token: {token.key}')

# 3. Update town-builder secret
kubectl -n town-builder patch secret town-builder-secrets \
  -p '{"stringData":{"TOWN_API_JWT_TOKEN":"<token-key>"}}'
```

**Note**: The header format is different:
- JWT: `Authorization: Bearer <token>`
- DRF Token: `Authorization: Token <token>`

You'd need to update `app/routes/town.py` and `app/services/django_client.py` to use `Token` instead of `Bearer`.

---

### Option 3: Increase JWT Access Token Lifetime
**Complexity**: Low | **Recommended for**: Quick fix (not ideal for production)

Increase the JWT access token lifetime in Django settings.

**Pros**:
- Simplest immediate fix
- No code changes in town-builder

**Cons**:
- Security risk (longer-lived tokens)
- Still expires eventually
- Not best practice for access tokens

**Implementation**:
```python
# In Django settings.py
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=30),  # Or whatever duration you need
    'REFRESH_TOKEN_LIFETIME': timedelta(days=365),
}

# Then regenerate the token
```

---

### Option 4: Create Service Account with Long-Lived Token
**Complexity**: Medium | **Recommended for**: Production service-to-service auth

Create a dedicated service account in Django with special long-lived JWT settings or a custom token.

**Pros**:
- Separates service accounts from user accounts
- Can have different security policies
- Clear audit trail

**Cons**:
- Requires Django code changes
- More setup complexity

**Implementation**:
```python
# 1. Create a service account user
from django.contrib.auth import get_user_model
User = get_user_model()
service_user, created = User.objects.get_or_create(
    username='town-builder-service',
    defaults={'is_active': True, 'is_staff': False}
)

# 2. Create custom JWT with longer lifetime
from rest_framework_simplejwt.tokens import RefreshToken

class LongLivedRefreshToken(RefreshToken):
    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        # Set custom expiration for service accounts
        token.set_exp(lifetime=timedelta(days=365))
        return token

token = LongLivedRefreshToken.for_user(service_user)
access_token = str(token.access_token)
```

---

### Option 5: Mutual TLS (mTLS) or API Keys
**Complexity**: High | **Recommended for**: High security production environments

Use certificate-based authentication or API keys instead of tokens.

**Pros**:
- More secure for service-to-service communication
- No token expiration issues
- Industry standard for microservices

**Cons**:
- Significant infrastructure changes required
- Complex setup and management
- Requires certificate authority

---

## Recommendation

For your use case (internal Kubernetes service-to-service communication):

**Short-term**: Use **Option 2 (DRF Token Authentication)**
- Simplest and most appropriate for service accounts
- No expiration management needed
- Easy to implement

**Long-term**: Consider **Option 4 (Service Account)** or **Option 5 (mTLS)**
- Better security model
- Proper separation of concerns
- Production-ready

## Current Configuration Files

- JWT token stored in: `kubectl -n town-builder get secret town-builder-secrets`
- Django authentication: `djangorestframework-simplejwt`
- Town-builder client code: `app/services/django_client.py` and `app/routes/town.py`

## Next Steps

1. Choose authentication method
2. Update Django configuration (if needed)
3. Generate new token/credentials
4. Update Kubernetes secret
5. Test authentication
6. Document the chosen approach
