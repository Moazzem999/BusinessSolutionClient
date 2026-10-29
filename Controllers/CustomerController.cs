using Microsoft.AspNetCore.Mvc;

namespace BusinessSolutionClient.Controllers
{
    public class CustomerController : Controller
    {
        private readonly IConfiguration _configuration;

        public CustomerController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpGet]
        public IActionResult List()
        {
            ViewBag.ApiBaseUrl = _configuration["ApiSettings:BaseUrl"] ?? "https://localhost:7148/api";
            return View();
        }

        [HttpGet]
        public IActionResult Index()
        {
            return RedirectToAction(nameof(List));
        }
    }
}

