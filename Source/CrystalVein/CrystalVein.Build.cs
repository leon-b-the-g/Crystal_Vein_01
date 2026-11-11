using UnrealBuildTool;

public class CrystalVein : ModuleRules
{
	public CrystalVein(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		// Json, Sockets, Networking: the link to the sim (CVSimLink). Slate: the HUD (SCVHud).
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "Json", "Sockets", "Networking", "Slate", "SlateCore" });
		// VorbisAudioDecoder: the web build's .ogg sounds are decoded at run time (CVSound). AudioExtensions: a sound wave subclass
		// (CVSoundWave) links against it. AudioMixer: the demo run records what it plays.
		PrivateDependencyModuleNames.AddRange(new string[] { "VorbisAudioDecoder", "AudioExtensions", "AudioMixer" });
	}
}
