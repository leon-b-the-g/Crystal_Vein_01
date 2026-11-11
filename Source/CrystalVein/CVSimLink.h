#pragma once

#include "CoreMinimal.h"
#include "HAL/PlatformProcess.h"

class FJsonObject;
class FSocket;

// What the sim sends (apps/x-stranded/src/snapshot.ts), read into plain structs. Everything is in sim units:
// positions in px (FCVLevel::TileSize px per tile), angles in radians, tiles as tilemap.ts's enumTile.

struct FCVLamp { FVector2D Pos = FVector2D::ZeroVector; float Radius = 0.f; bool bAlways = false; };
struct FCVThing { FString Kind; FIntPoint Tile = FIntPoint::ZeroValue; };

/** The deck: sent once, and again after a restart. Tiles is kept up to date from each snapshot's changes. */
struct FCVLevel
{
	int32 W = 0;
	int32 H = 0;
	float TileSize = 16.f;
	float MaxHealth = 100.f;
	float MaxStamina = 100.f;
	TArray<uint8> Tiles;
	TArray<FCVLamp> Lamps;
	TArray<FCVThing> Things;

	bool IsValid() const { return W > 0 && H > 0 && TileSize > 0.f && Tiles.Num() == W * H; }
};

struct FCVAlien { int32 Id = 0; FString Type; FVector2D Pos = FVector2D::ZeroVector; float Facing = 0.f; float Radius = 4.f; int32 Flags = 0; };
struct FCVItem { FVector2D Pos = FVector2D::ZeroVector; FString Name; };
struct FCVEvent { FString Kind; TArray<FString> Args; };

/** FCVSnap::Flags */
namespace ECVFlag
{
	enum { Alive = 1, Sprinting = 2, Crouching = 4, Hidden = 8, Moving = 16, Swinging = 32, Hurt = 64, HasCell = 128 };
}
/** FCVAlien::Flags */
namespace ECVAlienFlag
{
	enum { Emerging = 1, Moving = 2, Chasing = 4, Hit = 8 };
}

/** One sim tick. */
struct FCVSnap
{
	int32 Tick = -1;
	FVector2D Pos = FVector2D::ZeroVector;
	float Aim = 0.f;
	float Health = 0.f;
	float Stamina = 0.f;
	float LightIntensity = 0.f;
	float Channel = -1.f;
	int32 Flags = 0;
	bool bLightOn = false;
	bool bLightDead = false;
	bool bPower = false;
	TArray<FCVAlien> Aliens;
	TArray<FVector2D> Corpses;
	TArray<FCVItem> Items;
	TArray<int32> Loot;
	TArray<int32> Fires;
	TArray<FString> Quick;
	FString Message;
	FString Objective;
	FString Prompt;
	FString Room;
	FString Cause;
	FString Weapon;

	bool Has(int32 Flag) const { return (Flags & Flag) != 0; }
};

/**
 * The link to the sim: starts Sim/sidecar.mjs with Node, talks JSON lines to it over local TCP, and holds the latest level and
 * snapshot. Nothing here blocks: the connection is polled.
 * shortcut: a separate process and JSON text; when the sim is embedded in Unreal, this class is what gets replaced, its structs stay.
 */
class FCVSimLink
{
public:
	~FCVSimLink();

	/** starts the sim and begins reaching for it */
	void Start();
	void Stop();
	/** reads what has arrived. True when Snap is new. Events holds what the story reported since the last call. */
	bool Poll(float DeltaTime);
	/** this frame's input, in the sim's wire units: move -127..127, aim in quarter px from the player, input.ts's button bits, quick slot or -1 */
	void SendInput(int32 MoveX, int32 MoveY, int32 AimX, int32 AimY, int32 Bits, int32 Quick, bool bPause, bool bRestart);

	bool IsConnected() const { return Socket != nullptr && bConnected; }
	bool IsWanted() const { return bWanted; }

	FCVLevel Level;
	FCVSnap Snap;
	TArray<FCVEvent> Events;
	/** set when the level was replaced / when tiles changed; the reader clears them */
	bool bLevelChanged = false;
	bool bTilesChanged = false;
	/** a line for the screen while there is no sim; empty when all is well */
	FString Status;

private:
	void BeginConnect();
	void CloseSocket();
	void HandleLine(const FString& Line);
	void ReadLevel(const TSharedPtr<FJsonObject>& Object);
	void ReadSnap(const TSharedPtr<FJsonObject>& Object);

	FSocket* Socket = nullptr;
	FProcHandle Process;
	TArray<uint8> Inbox;
	float RetryIn = 0.f;
	float Waited = 0.f;
	int32 Tries = 0;
	bool bConnected = false;
	bool bWanted = false;
	bool bNewSnap = false;
	bool bLoggedSnap = false;
};
