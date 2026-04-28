using Microsoft.AspNetCore.Mvc;

namespace Ledgerra.Api.Extensions;

public static class ControllerValidationExtensions
{
    public static BadRequestObjectResult ValidationError(this ControllerBase controller, IDictionary<string, string[]> errors)
    {
        return controller.BadRequest(new ValidationProblemDetails(errors));
    }
}
