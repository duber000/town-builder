# Security Fixes - JavaScript & Backend Review

This document outlines the critical security vulnerabilities that were identified and fixed in this commit.

## Critical Vulnerabilities Fixed

### 1. Path Traversal Vulnerability (CVE-CRITICAL)
**Impact:** HIGH - Could allow arbitrary file read/write on the server

**Locations Fixed:**
- `app/routes/town.py:130` - save_town endpoint
- `app/routes/town.py:242` - load_town endpoint
- `app/routes/models.py:49` - model loading endpoint

**Previous Vulnerable Code:**
```python
# VULNERABLE - User could specify paths like "../../../etc/passwd"
with open(filename, 'w') as f:
    json.dump(town_data_to_save, f, indent=2)
```

**Fix Applied:**
- Created `app/utils/security.py` with path validation functions
- Added `validate_filename()` to sanitize filenames and reject path traversal attempts
- Added `get_safe_filepath()` to enforce file operations within designated directories
- Added `validate_model_path()` to validate category and model names
- Created dedicated `data/` directory for town saves
- All file operations now use validated paths that cannot escape their designated directory

**Mitigation:**
- Filenames are validated against regex pattern: `^[a-zA-Z0-9._-]+$`
- Path separators (`/`, `\`, `..`) are rejected
- Files are constrained to designated directories using Path.resolve() validation
- Null bytes and special characters are blocked

### 2. CORS Wildcard with Credentials (CVE-MEDIUM)
**Impact:** MEDIUM - Any website could make authenticated requests to the API

**Location Fixed:**
- `app/main.py:30-36` - CORS middleware configuration

**Previous Vulnerable Code:**
```python
# VULNERABLE - Allows any origin to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
)
```

**Fix Applied:**
- Changed from wildcard `["*"]` to configurable allowed origins list
- Added `ALLOWED_ORIGINS` environment variable for production configuration
- Default development origins: `http://localhost:3000,http://localhost:5001,http://127.0.0.1:5001`
- Added logging to track configured origins

**Configuration:**
Set `ALLOWED_ORIGINS` environment variable in production:
```bash
export ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
```

### 3. Server-Side Request Forgery (SSRF) Prevention
**Impact:** MEDIUM - Could allow internal network scanning or metadata service access

**Location Fixed:**
- `app/services/django_client.py` - All API request functions

**Fix Applied:**
- Added `validate_api_url()` function to check URLs against allowlist
- Added `allowed_api_domains` configuration in settings
- Base URL validation in `_get_base_url()` before making requests
- Rejects requests to unlisted domains

**Configuration:**
Update `app/config.py` to set allowed API domains:
```python
allowed_api_domains: list = ['localhost', '127.0.0.1', 'api.yourdomain.com']
```

## Additional Security Improvements

### Input Validation
- All user-controlled filenames are now validated
- Path components are stripped to basename only
- Only alphanumeric characters, dots, dashes, and underscores allowed in filenames
- File extension validation enforced

### Defense in Depth
Multiple layers of protection:
1. Input validation (regex, character filtering)
2. Path resolution and relative path checking
3. Directory confinement using Path.resolve()
4. Explicit allowlists for domains and file extensions

## Configuration Required

### For Production Deployment:

1. **Set ALLOWED_ORIGINS:**
   ```bash
   export ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
   ```

2. **Configure Allowed API Domains:**
   Edit `app/config.py` line 52:
   ```python
   allowed_api_domains: list = ['your-api-domain.com']
   ```

3. **Ensure JWT_SECRET_KEY is set:**
   ```bash
   export JWT_SECRET_KEY="your-secure-random-key-here"
   ```

## Testing

Run security tests:
```bash
# Test path traversal prevention
curl -X POST http://localhost:5001/api/town/save \
  -H "Content-Type: application/json" \
  -d '{"filename": "../../../etc/passwd", "data": []}'
# Should return: 400 Bad Request - "Invalid filename: path traversal attempts are not allowed"

# Test CORS configuration
curl -H "Origin: https://malicious-site.com" http://localhost:5001/api/town
# Should be blocked by CORS if not in allowed origins
```

## Remaining Security Recommendations

### Medium Priority:
1. Add rate limiting to prevent API abuse
2. Implement Content Security Policy (CSP) headers
3. Add input length limits to prevent DoS
4. Sanitize error messages to prevent information disclosure
5. Add audit logging for sensitive operations

### Low Priority:
6. Implement proper user authentication (not just username in cookie)
7. Add CSRF tokens if using cookie-based authentication
8. Consider adding API request signing
9. Regular security audits and dependency updates
10. Add security headers (X-Frame-Options, X-Content-Type-Options, etc.)

## Files Modified

- `app/config.py` - Added data_path, allowed_origins, allowed_api_domains
- `app/utils/security.py` - NEW - Security validation utilities
- `app/routes/town.py` - Fixed path traversal in save/load endpoints
- `app/routes/models.py` - Fixed path traversal in model loading
- `app/services/django_client.py` - Added SSRF prevention
- `app/main.py` - Fixed CORS wildcard configuration
- `data/` - NEW - Safe directory for town save files

## References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- CWE-22 Path Traversal: https://cwe.mitre.org/data/definitions/22.html
- CWE-918 SSRF: https://cwe.mitre.org/data/definitions/918.html
- CORS Best Practices: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
