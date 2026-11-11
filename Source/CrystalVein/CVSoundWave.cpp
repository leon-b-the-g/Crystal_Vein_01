#include "CVSoundWave.h"
#include "Audio.h"

UCVSoundWave::UCVSoundWave(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	VirtualizationMode = EVirtualizationMode::PlayWhenSilent; // a loop fades in from nothing: it must not be dropped for being quiet
}

void UCVSoundWave::Start(const TSharedPtr<const FCVPcm, ESPMode::ThreadSafe>& InPcm, bool bInLoop)
{
	FScopeLock Lock(&Guard);
	Pcm = InPcm;
	Cursor = 0;
	bLoop = bInLoop;
	SetSampleRate((uint32)InPcm->SampleRate);
	NumChannels = InPcm->Channels;
	Duration = INDEFINITELY_LOOPING_DURATION; // CVSound stops a one-shot when its time is up
	SoundGroup = SOUNDGROUP_Default;
	bLooping = false;
}

int32 UCVSoundWave::OnGeneratePCMAudio(TArray<uint8>& OutAudio, int32 NumSamples)
{
	FScopeLock Lock(&Guard);
	if (!Pcm.IsValid() || NumSamples <= 0)
	{
		return 0;
	}
	const int32 Total = Pcm->Data.Num() / 2;
	OutAudio.Reset();
	OutAudio.AddZeroed(NumSamples * 2);
	int32 Written = 0;
	while (Written < NumSamples && Total > 0)
	{
		if (Cursor >= Total)
		{
			if (!bLoop)
			{
				break; // played out: silence from here on
			}
			Cursor = 0;
		}
		const int32 Count = FMath::Min(NumSamples - Written, Total - Cursor);
		FMemory::Memcpy(OutAudio.GetData() + Written * 2, Pcm->Data.GetData() + Cursor * 2, Count * 2);
		Written += Count;
		Cursor += Count;
	}
	return Written;
}
