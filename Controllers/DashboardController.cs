using Microsoft.AspNetCore.Mvc;

namespace BusinessSolutionClient.Controllers
{
    public class DashboardController : Controller
    {
        private readonly IConfiguration _configuration;

        public DashboardController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpGet]
        public IActionResult Index()
        {
            ViewBag.ApiBaseUrl = _configuration["ApiSettings:BaseUrl"] ?? "https://localhost:7148/api";
            return View();
        }
    }
}
