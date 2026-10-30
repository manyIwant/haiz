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
        var configFile = Path.Combine(PluginConfigFolder, "haiz-screen.json");
        HomeworkComponent.ConfigFile = configFile;
        EveningHomeworkService.ConfigFile = configFile;

        // Preserve the v1.3 native component and register a separate,
        // opt-in timetable watcher. Neither service changes ClassIsland data.
        services.AddComponent<HomeworkComponent>();
        services.AddHostedService<EveningHomeworkService>();
    }
}
