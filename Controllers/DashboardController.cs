using Microsoft.AspNetCore.Mvc;

namespace BusinessSolutionClient.Controllers
{
    public class DashboardController : Controller
    {
        [HttpGet]
        public IActionResult Index()
        {
            return View();
        }
    }
}
