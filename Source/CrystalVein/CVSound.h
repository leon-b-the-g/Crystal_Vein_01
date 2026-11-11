#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CVSimLink.h"
#include "CVSound.generated.h"

class UAudioComponent;
struct FCVPcm;

/**
 * Plays what the sim says should sound (FCVSound). The files are the web build's recordings, copied to the project's Audio folder
 * (npm run sim:unreal), decoded when first used. The sim has already set each sound's level for distance and for a wall in
 * between; here a placed sound is only put left or right of the listener, and muffled when the sim says so.
 * shortcut: no buses, no reverb, files decoded on the game thread (the two-minute music track costs a short hitch at the start).
 * Import the sounds as assets and give them attenuation and submixes when the art pass reaches sound.
 */
UCLASS()
class ACVSound : public AActor
{
	GENERATED_BODY()

public:
	ACVSound();

	/** sounds that start now */
	void Play(const TArray<FCVSound>& Shots, float UnitsPerPx);
	/** the loops that should be running until the next list comes */
	void SetLoops(const TArray<FCVSound>& Loops, float UnitsPerPx);
	/** every frame: loops fade towards their level, voices that have played out are freed */
	void Update(float DeltaTime);
	/** everything quiet at once (a restart) */
	void Silence();

	/** The level of everything. At 0.7 the demo run peaked at -10 dBFS and averaged -28 (measured, 2026-11-11): 1 uses that headroom. */
	UPROPERTY(EditAnywhere, Category = "Sound")
	float Master = 1.f;

	/** for the log: one-shots started, files that could not be read, loops running now */
	int32 Started = 0;
	int32 Unreadable = 0;
	int32 LoopsRunning() const;

private:
	struct FVoice
	{
		FString Key; // a loop's name; empty for a one-shot
		FString File;
		float EndsAt = 0.f;
		float Level = 0.f;
		float Wanted = 0.f;
		bool bBusy = false;
	};

	TSharedPtr<const FCVPcm, ESPMode::ThreadSafe> Load(const FString& File, bool bMono);
	int32 FreeVoice();
	bool Start(int32 Index, const FCVSound& Sound, float UnitsPerPx, bool bLoop);
	void Place(int32 Index, const FCVSound& Sound, float UnitsPerPx);

	UPROPERTY()
	TArray<TObjectPtr<UAudioComponent>> Components;

	TArray<FVoice> Voices;
	TMap<FString, TSharedPtr<const FCVPcm, ESPMode::ThreadSafe>> Cache;
	TSet<FString> Missing;
};
