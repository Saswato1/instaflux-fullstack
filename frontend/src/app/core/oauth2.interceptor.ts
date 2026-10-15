import { HttpInterceptorFn } from '@angular/common/http';

export const oauth2BearerInterceptor: HttpInterceptorFn = (req, next) => {
  const token = sessionStorage.getItem('oauth2_access_token');
  if (token && req.url.startsWith('/api/')) {
    return next(
      req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          'X-Client-Platform': 'Angular-18-PKCE'
        }
      })
    );
  }
  return next(req);
};
