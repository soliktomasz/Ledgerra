FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend/Ledgerra.sln backend/
COPY backend/src/Ledgerra.Api/Ledgerra.Api.csproj backend/src/Ledgerra.Api/
COPY backend/src/Ledgerra.Domain/Ledgerra.Domain.csproj backend/src/Ledgerra.Domain/
COPY backend/src/Ledgerra.Application/Ledgerra.Application.csproj backend/src/Ledgerra.Application/
COPY backend/src/Ledgerra.Infrastructure/Ledgerra.Infrastructure.csproj backend/src/Ledgerra.Infrastructure/
COPY backend/tests/Ledgerra.Domain.Tests/Ledgerra.Domain.Tests.csproj backend/tests/Ledgerra.Domain.Tests/
COPY backend/tests/Ledgerra.Api.Tests/Ledgerra.Api.Tests.csproj backend/tests/Ledgerra.Api.Tests/

RUN dotnet restore backend/Ledgerra.sln

COPY backend backend

RUN dotnet publish backend/src/Ledgerra.Api/Ledgerra.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "Ledgerra.Api.dll"]
