#include "CVSound.h"
#include "CrystalVein.h"
#include "CVSoundWave.h"
#include "Audio.h"
#include "Components/AudioComponent.h"
#include "Components/SceneComponent.h"
#include "Decoders/VorbisAudioInfo.h"
#include "Engine/World.h"
#include "Interfaces/IAudioFormat.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Sound/SoundAttenuation.h"

namespace
{
	const int32 MaxVoices = 32;
	const float FadePerSecond = 2.5f; // a loop comes up or dies away in under half a second
	const float Quiet = 0.001f;       // as good as silent, and still above where the mixer drops a sound
}

ACVSound::ACVSound()
{
	PrimaryActorTick.bCanEverTick = false; // the controller calls Update
	SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));
}

int32 ACVSound::LoopsRunning() const
{
	int32 Count = 0;
	for (const FVoice& Voice : Voices)
	{
		Count += Voice.bBusy && !Voice.Key.IsEmpty() ? 1 : 0;
	}
	return Count;
}

TSharedPtr<const FCVPcm, ESPMode::ThreadSafe> ACVSound::Load(const FString& File, bool bMono)
{
	const FString CacheKey = bMono ? File + TEXT("|mono") : File;
	if (const TSharedPtr<const FCVPcm, ESPMode::ThreadSafe>* Found = Cache.Find(CacheKey))
	{
		return *Found;
	}
	if (Missing.Contains(File))
	{
		return nullptr;
	}
	TSharedPtr<FCVPcm, ESPMode::ThreadSafe> Pcm = MakeShared<FCVPcm, ESPMode::ThreadSafe>();
	TArray<uint8> Bytes;
	bool bRead = false;
	// the name comes over the wire from the sim: it stays inside the Audio folder
	const bool bInside = !File.IsEmpty() && !File.Contains(TEXT("..")) && !File.Contains(TEXT(":")) && !File.StartsWith(TEXT("/")) && !File.StartsWith(TEXT("\\"));
	if (bInside && FFileHelper::LoadFileToArray(Bytes, *FPaths::Combine(FPaths::ProjectDir(), TEXT("Audio"), File), FILEREAD_Silent))
	{
		if (File.EndsWith(TEXT(".wav")))
		{
			FWaveModInfo Info;
			if (Info.ReadWaveInfo(Bytes.GetData(), Bytes.Num()) && *Info.pBitsPerSample == 16)
			{
				Pcm->SampleRate = (int32)*Info.pSamplesPerSec;
				Pcm->Channels = (int32)*Info.pChannels;
				Pcm->Data.Append(Info.SampleDataStart, (int32)Info.SampleDataSize);
				bRead = true;
			}
		}
		else
		{
			LoadVorbisLibraries();
			FVorbisAudioInfo Vorbis;
			FSoundQualityInfo Quality;
			if (Vorbis.ReadCompressedInfo(Bytes.GetData(), (uint32)Bytes.Num(), &Quality) && Quality.SampleDataSize > 0)
			{
				Pcm->SampleRate = (int32)Quality.SampleRate;
				Pcm->Channels = (int32)Quality.NumChannels;
				Pcm->Data.SetNumUninitialized((int32)Quality.SampleDataSize);
				Vorbis.ExpandFile(Pcm->Data.GetData(), &Quality);
				bRead = true;
			}
		}
	}
	if (!bRead || Pcm->SampleRate < 8000 || Pcm->Channels < 1 || Pcm->Channels > 2 || Pcm->Data.Num() < 4)
	{
		Missing.Add(File);
		++Unreadable;
		UE_LOG(LogCrystalVein, Warning, TEXT("Sound: cannot read Audio/%s"), *File);
		return nullptr;
	}
	if (bMono && Pcm->Channels == 2)
	{
		// a placed sound is one point: the two channels are folded together
		int16* Samples = (int16*)Pcm->Data.GetData();
		const int32 Frames = Pcm->Data.Num() / 4;
		for (int32 Frame = 0; Frame < Frames; ++Frame)
		{
			Samples[Frame] = (int16)(((int32)Samples[Frame * 2] + (int32)Samples[Frame * 2 + 1]) / 2);
		}
		Pcm->Data.SetNum(Frames * 2);
		Pcm->Channels = 1;
	}
	Cache.Add(CacheKey, Pcm);
	return Pcm;
}

int32 ACVSound::FreeVoice()
{
	for (int32 Index = 0; Index < Voices.Num(); ++Index)
	{
		if (!Voices[Index].bBusy)
		{
			return Index;
		}
	}
	if (Voices.Num() >= MaxVoices)
	{
		return INDEX_NONE;
	}
	UAudioComponent* Component = NewObject<UAudioComponent>(this);
	Component->bAutoActivate = false;
	Component->bAutoDestroy = false;
	Component->bOverrideAttenuation = true;
	Component->SetupAttachment(GetRootComponent());
	Component->RegisterComponent();
	Components.Add(Component);
	return Voices.AddDefaulted();
}

void ACVSound::Place(int32 Index, const FCVSound& Sound, float UnitsPerPx)
{
	UAudioComponent* Component = Components[Index];
	if (Sound.bPlaced)
	{
		Component->SetWorldLocation(FVector(Sound.Pos.X * UnitsPerPx, Sound.Pos.Y * UnitsPerPx, 100.0));
	}
	Component->SetLowPassFilterEnabled(Sound.bMuffled);
	Component->SetLowPassFilterFrequency(Sound.bMuffled ? 500.f : 20000.f); // behind a wall, as the web build muffles it
}

bool ACVSound::Start(int32 Index, const FCVSound& Sound, float UnitsPerPx, bool bLoop)
{
	const TSharedPtr<const FCVPcm, ESPMode::ThreadSafe> Pcm = Load(Sound.File, Sound.bPlaced);
	if (!Pcm.IsValid())
	{
		return false;
	}
	UAudioComponent* Component = Components[Index];
	Component->Stop();
	UCVSoundWave* Wave = NewObject<UCVSoundWave>(this);
	Wave->Start(Pcm, bLoop);

	// The sim has set the level. Here: left or right for a placed sound, growing towards the middle as it comes close.
	FSoundAttenuationSettings& Ears = Component->AttenuationOverrides;
	Ears.bAttenuate = false;
	Ears.bSpatialize = Sound.bPlaced;
	Ears.bAttenuateWithLPF = false;
	Ears.bEnableListenerFocus = false;
	Ears.bEnableOcclusion = false;
	Ears.bEnableReverbSend = false;
	Ears.NonSpatializedRadiusStart = 1200.f;
	Ears.NonSpatializedRadiusEnd = 200.f;
	Component->bAllowSpatialization = Sound.bPlaced;
	Component->SetSound(Wave);
	Component->SetPitchMultiplier(FMath::Clamp(Sound.Rate, 0.5f, 2.f));
	Place(Index, Sound, UnitsPerPx);

	FVoice& Voice = Voices[Index];
	Voice.bBusy = true;
	Voice.Key = bLoop ? Sound.Key : FString();
	Voice.File = Sound.File;
	Voice.Wanted = Sound.Gain;
	Voice.Level = bLoop ? 0.f : Sound.Gain;
	Voice.EndsAt = bLoop ? TNumericLimits<float>::Max() : (float)GetWorld()->GetTimeSeconds() + Pcm->Seconds() / FMath::Clamp(Sound.Rate, 0.5f, 2.f) + 0.15f;
	Component->SetVolumeMultiplier(FMath::Max(Quiet, Voice.Level * Master));
	Component->Play();
	return true;
}

void ACVSound::Play(const TArray<FCVSound>& Shots, float UnitsPerPx)
{
	for (const FCVSound& Shot : Shots)
	{
		const int32 Index = Shot.Gain > Quiet ? FreeVoice() : INDEX_NONE;
		if (Index != INDEX_NONE && Start(Index, Shot, UnitsPerPx, false))
		{
			++Started;
		}
	}
}

void ACVSound::SetLoops(const TArray<FCVSound>& Loops, float UnitsPerPx)
{
	for (FVoice& Voice : Voices)
	{
		if (Voice.bBusy && !Voice.Key.IsEmpty())
		{
			Voice.Wanted = 0.f; // unless the new list names it again
		}
	}
	for (const FCVSound& Loop : Loops)
	{
		int32 Index = Voices.IndexOfByPredicate([&Loop](const FVoice& Voice) { return Voice.bBusy && Voice.Key == Loop.Key && Voice.File == Loop.File; });
		if (Index != INDEX_NONE)
		{
			Voices[Index].Wanted = Loop.Gain;
			Place(Index, Loop, UnitsPerPx);
		}
		else if ((Index = FreeVoice()) != INDEX_NONE)
		{
			Start(Index, Loop, UnitsPerPx, true);
		}
	}
}

void ACVSound::Update(float DeltaTime)
{
	const float Now = (float)GetWorld()->GetTimeSeconds();
	for (int32 Index = 0; Index < Voices.Num(); ++Index)
	{
		FVoice& Voice = Voices[Index];
		if (!Voice.bBusy)
		{
			continue;
		}
		if (Voice.Key.IsEmpty())
		{
			if (Now >= Voice.EndsAt)
			{
				Components[Index]->Stop();
				Voice.bBusy = false;
			}
			continue;
		}
		Voice.Level = FMath::FInterpConstantTo(Voice.Level, Voice.Wanted, DeltaTime, FadePerSecond);
		Components[Index]->SetVolumeMultiplier(FMath::Max(Quiet, Voice.Level * Master));
		if (Voice.Wanted <= 0.f && Voice.Level <= Quiet)
		{
			Components[Index]->Stop();
			Voice.bBusy = false;
		}
	}
}

void ACVSound::Silence()
{
	for (int32 Index = 0; Index < Voices.Num(); ++Index)
	{
		Components[Index]->Stop();
		Voices[Index].bBusy = false;
	}
}
