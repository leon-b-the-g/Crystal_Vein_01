using UnrealBuildTool;
using System.Collections.Generic;

public class CrystalVeinTarget : TargetRules
{
	public CrystalVeinTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V7;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
		ExtraModuleNames.Add("CrystalVein");
	}
}
