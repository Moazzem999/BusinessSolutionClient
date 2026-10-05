using Microsoft.AspNetCore.Mvc;

namespace BusinessSolutionClient.Controllers
{
    public class EmployeeController : Controller
    {
        private readonly IConfiguration _configuration;

        public EmployeeController(IConfiguration configuration)
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
        public IActionResult Create()
        {
            ViewBag.ApiBaseUrl = _configuration["ApiSettings:BaseUrl"] ?? "https://localhost:7148/api";
            return View();
        }

        [HttpGet]
        public IActionResult AdvancePayment()
        {
            ViewBag.ApiBaseUrl = _configuration["ApiSettings:BaseUrl"] ?? "https://localhost:7148/api";
            return View();
        }
    }
}
