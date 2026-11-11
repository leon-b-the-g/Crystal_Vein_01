#pragma once

#include "CoreMinimal.h"
#include "Sound/SoundWaveProcedural.h"
#include "CVSoundWave.generated.h"

/** A decoded sound file: 16 bit samples, the channels interleaved. Shared by everything that plays it. */
struct FCVPcm
{
	TArray<uint8> Data;
	int32 SampleRate = 44100;
	int32 Channels = 1;

	float Seconds() const { return SampleRate > 0 && Channels > 0 ? (float)(Data.Num() / 2 / Channels) / (float)SampleRate : 0.f; }
};

/**
 * Plays an FCVPcm once or round and round. The mixer asks for samples on its own thread; they are handed out from the shared buffer.
 * shortcut: the web build's sound files are read and decoded at run time (CVSound) and are not Unreal assets, so they need this
 * to be played. Once the sounds are imported, they are plain USoundWaves and this class goes.
 */
UCLASS()
class UCVSoundWave : public USoundWaveProcedural
{
	GENERATED_BODY()

public:
	UCVSoundWave(const FObjectInitializer& ObjectInitializer);

	/** before it is played: what to play, and whether it starts over at its end */
	void Start(const TSharedPtr<const FCVPcm, ESPMode::ThreadSafe>& InPcm, bool bInLoop);

	virtual int32 OnGeneratePCMAudio(TArray<uint8>& OutAudio, int32 NumSamples) override;

private:
	FCriticalSection Guard;
	TSharedPtr<const FCVPcm, ESPMode::ThreadSafe> Pcm;
	int32 Cursor = 0; // in samples, every channel counted
	bool bLoop = false;
};
