using System.IO;
using ClassIsland.Core.Abstractions;
using ClassIsland.Core.Attributes;
using ClassIsland.Core.Extensions.Registry;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HAIZ.ClassroomPlugin;

[PluginEntrance]
public sealed class Plugin : PluginBase
{
    public override void Initialize(HostBuilderContext context, IServiceCollection services)
    {
        HomeworkComponent.ConfigFile = Path.Combine(PluginConfigFolder, "haiz-screen.json");
        services.AddComponent<HomeworkComponent>();
    }
}
