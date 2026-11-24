#pragma once

#include "CoreMinimal.h"
#include "HAL/PlatformProcess.h"

class FJsonObject;
class FSocket;

// What the sim sends (apps/x-stranded/src/snapshot.ts), read into plain structs. Everything is in sim units:
// positions in px (FCVLevel::TileSize px per tile), angles in radians, tiles as tilemap.ts's enumTile.

struct FCVLamp { FVector2D Pos = FVector2D::ZeroVector; float Radius = 0.f; bool bAlways = false; };
struct FCVThing { FString Kind; FIntPoint Tile = FIntPoint::ZeroValue; };
struct FCVRoom { FString Name; FIntRect Area; };
/** growth on its way into a floor tile: the side it comes from (0 west, 1 north, 2 east, 3 south of the tile) and how far it is, 0 to 1 */
struct FCVGrowing { int32 Tile = 0; int32 Side = 0; float Done = 0.f; };
/** a door on its way, one per leaf: opening (else shutting), and how far, 0 to 1 */
struct FCVDoorMove { int32 Tile = 0; bool bOpening = true; float Done = 0.f; };
/** a cloud of spores, the story's red mist among them, in px; Density 0 to 1 */
struct FCVCloud { FVector2D Pos = FVector2D::ZeroVector; float Radius = 0.f; float Density = 0.f; };
/** a dead body: "crew", or the type of the alien it was */
struct FCVCorpse { FString Type; FVector2D Pos = FVector2D::ZeroVector; bool bBurning = false; };

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
	TArray<FCVRoom> Rooms;
	/** growth: s of age at which a tile starts to harden, is hard and hurts whoever stands on it, and s a new tile takes to grow in */
	float CreepHarden = 240.f;
	float CreepHard = 300.f;
	float CreepGrow = 12.f;
	/** the sim's tick when the level was sent (0 at the start, the checkpoint's after a restart) */
	int32 Tick = 0;
	/** growth that was already old when the level was sent: tile, s */
	TMap<int32, int32> CreepAges;

	/** the room this tile lies in; nothing for a wall or a doorway */
	FString RoomAt(const FIntPoint& Tile) const
	{
		for (const FCVRoom& Room : Rooms)
		{
			if (Room.Area.Contains(Tile))
			{
				return Room.Name;
			}
		}
		return FString();
	}

	bool IsValid() const { return W > 0 && H > 0 && TileSize > 0.f && Tiles.Num() == W * H; }
};

struct FCVAlien { int32 Id = 0; FString Type; FVector2D Pos = FVector2D::ZeroVector; float Facing = 0.f; float Radius = 4.f; int32 Flags = 0; };
struct FCVItem { FVector2D Pos = FVector2D::ZeroVector; FString Name; };
struct FCVEvent { FString Kind; TArray<FString> Args; };
/** Something thrown, in the air or lying where it landed with Left seconds to go. Kind: 0 a flare, 1 a noisemaker, 2 anything else. */
struct FCVThrown { FVector2D Pos = FVector2D::ZeroVector; float Left = 0.f; int32 Kind = 2; bool bFlying = false; };
/** A sound the sim asks for (cues.ts): a one-shot to start or, with a Key, a loop to keep running. File is under the Audio folder. Gain holds distance and walls already. */
struct FCVSound { FString Key; FString File; FVector2D Pos = FVector2D::ZeroVector; float Gain = 0.f; float Rate = 1.f; bool bPlaced = false; bool bMuffled = false; };

/** FCVSnap::Flags */
namespace ECVFlag
{
	enum { Alive = 1, Sprinting = 2, Crouching = 4, Hidden = 8, Moving = 16, Swinging = 32, Hurt = 64, HasCell = 128 };
}
/** FCVAlien::Flags */
namespace ECVAlienFlag
{
	enum { Emerging = 1, Moving = 2, Chasing = 4, Hit = 8, Rearing = 16, Striking = 32 };
}

/** One sim tick. */
struct FCVSnap
{
	int32 Tick = -1;
	FVector2D Pos = FVector2D::ZeroVector;
	float Aim = 0.f;
	float Health = 0.f;
	float Stamina = 0.f;
	/** spore load, 0 to 100: above 50 it costs health (story mode: the bites of the infected carry it) */
	float Spores = 0.f;
	float LightIntensity = 0.f;
	float Channel = -1.f;
	int32 Flags = 0;
	bool bLightOn = false;
	bool bLightDead = false;
	bool bPower = false;
	TArray<FCVAlien> Aliens;
	TArray<FCVCorpse> Corpses;
	TArray<FCVItem> Items;
	TArray<FCVThrown> Thrown;
	TArray<int32> Loot;
	TArray<int32> Fires;
	TArray<FString> Quick;
	/** what the player has found out and not yet dealt with (story.ts's clues) */
	TArray<FString> Clues;
	TArray<FCVGrowing> Growing;
	TArray<FCVDoorMove> DoorMoves;
	TArray<FCVCloud> Clouds;
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
	/**
	 * this frame's input, in the sim's wire units: move -127..127, aim in quarter px from the player, input.ts's button bits, quick slot or -1.
	 * bBot hands the controls to the sim's own bot (Sim/bot.mjs), which plays the section by itself: the demo run.
	 */
	void SendInput(int32 MoveX, int32 MoveY, int32 AimX, int32 AimY, int32 Bits, int32 Quick, bool bPause, bool bRestart, bool bBot);

	bool IsConnected() const { return Socket != nullptr && bConnected; }
	bool IsWanted() const { return bWanted; }

	FCVLevel Level;
	FCVSnap Snap;
	TArray<FCVEvent> Events;
	/** sounds that started since the last read; the reader empties it */
	TArray<FCVSound> Sounds;
	/** the loops that should be running; bLoopsChanged when a new list came, the reader clears it */
	TArray<FCVSound> Loops;
	bool bLoopsChanged = false;
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
