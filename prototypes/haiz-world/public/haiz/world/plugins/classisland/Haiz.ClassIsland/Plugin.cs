using ClassIsland.Core.Abstractions;
using ClassIsland.Core.Abstractions.Services;
using ClassIsland.Core.Attributes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Haiz.ClassIsland;

// SDK 2.1 source prototype. Host loading has not been validated on Windows.
[PluginEntrance]
public sealed class Plugin : PluginBase
{
    public override void Initialize(HostBuilderContext context, IServiceCollection services)
    {
        services.AddSingleton(new BridgeOptions(PluginConfigFolder));
        services.AddHostedService<HomeworkService>();
    }
}

public sealed record BridgeOptions(string Folder);
