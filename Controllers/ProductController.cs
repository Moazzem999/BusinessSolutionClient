using Microsoft.AspNetCore.Mvc;

namespace BusinessSolutionClient.Controllers
{
    public class ProductController : Controller
    {
        private readonly IConfiguration _configuration;

        public ProductController(IConfiguration configuration)
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
