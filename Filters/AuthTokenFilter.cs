using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace BusinessSolutionClient.Filters
{
    /// <summary>
    /// Global Action Filter that ensures users are authenticated before accessing protected pages.
    /// Redirects unauthenticated visitors to the login page.
    /// </summary>
    public class AuthTokenFilter : IActionFilter
    {
        public void OnActionExecuting(ActionExecutingContext context)
        {
            var controller = context.RouteData.Values["controller"]?.ToString()?.ToLowerInvariant();
            var action = context.RouteData.Values["action"]?.ToString()?.ToLowerInvariant();

            // Allow Account/Login (GET & POST) and Account/Logout
            if (controller == "account" && (action == "login" || action == "logout"))
            {
                return;
            }

            // Allow Home/Error
            if (controller == "home" && action == "error")
            {
                return;
            }

            // Check if auth token cookie exists and has value
            if (!context.HttpContext.Request.Cookies.TryGetValue("bs_auth_token", out var token) || string.IsNullOrWhiteSpace(token))
            {
                var requestPath = context.HttpContext.Request.Path.Value;
                var redirectUrl = string.IsNullOrWhiteSpace(requestPath) || requestPath == "/"
                    ? "/Account/Login"
                    : $"/Account/Login?ReturnUrl={Uri.EscapeDataString(requestPath)}";

                context.Result = new RedirectResult(redirectUrl);
            }
        }

        public void OnActionExecuted(ActionExecutedContext context)
        {
        }
    }
}
