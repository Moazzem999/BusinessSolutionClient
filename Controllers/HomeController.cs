using Microsoft.AspNetCore.Mvc;

namespace BusinessSolutionClient.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            if (Request.Cookies.ContainsKey("bs_auth_token"))
            {
                return RedirectToAction("Index", "Dashboard");
            }
            return RedirectToAction("Login", "Account");
        }
    }
}
