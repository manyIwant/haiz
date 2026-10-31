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
        DisplaySettingsStore.FilePath = configFile;
        EveningHomeworkService.ConfigFile = configFile;

        // Automation-only plugin: no ClassIsland toolbar component is registered.
        // The independent background watcher reads the real timetable and opens
        // a normal non-topmost window only during the two final self-study lessons.
        services.AddSettingsPage<ConnectionSettingsPage>();
        services.AddHostedService<EveningHomeworkService>();
    }
}
