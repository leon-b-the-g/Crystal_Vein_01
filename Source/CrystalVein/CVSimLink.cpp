#include "CVSimLink.h"
#include "CrystalVein.h"
#include "Common/TcpSocketBuilder.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Interfaces/IPv4/IPv4Address.h"
#include "Interfaces/IPv4/IPv4Endpoint.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "SocketSubsystem.h"
#include "Sockets.h"

namespace
{
	const int32 SimPort = 47800; // Sim/sidecar.mjs's default
	const int32 InboxLimit = 4 * 1024 * 1024;

	typedef TArray<TSharedPtr<FJsonValue>> FJsonArray;

	const FJsonArray& ArrayOf(const TSharedPtr<FJsonObject>& Object, const TCHAR* Field)
	{
		static const FJsonArray Empty;
		const FJsonArray* Found = nullptr;
		return Object->TryGetArrayField(Field, Found) && Found ? *Found : Empty;
	}
	const FJsonArray& ArrayOf(const TSharedPtr<FJsonValue>& Value)
	{
		static const FJsonArray Empty;
		const FJsonArray* Found = nullptr;
		return Value.IsValid() && Value->TryGetArray(Found) && Found ? *Found : Empty;
	}
	double NumberAt(const FJsonArray& Values, int32 Index)
	{
		double Number = 0.0;
		return Values.IsValidIndex(Index) && Values[Index].IsValid() && Values[Index]->TryGetNumber(Number) ? Number : 0.0;
	}
	FString StringAt(const FJsonArray& Values, int32 Index)
	{
		FString Text;
		return Values.IsValidIndex(Index) && Values[Index].IsValid() && Values[Index]->TryGetString(Text) ? Text : FString();
	}
}

FCVSimLink::~FCVSimLink()
{
	Stop();
}

void FCVSimLink::Start()
{
	Stop();
	const FString Script = FPaths::ConvertRelativePathToFull(FPaths::Combine(FPaths::ProjectDir(), TEXT("Sim"), TEXT("sidecar.mjs")));
	if (!FPaths::FileExists(Script))
	{
		Status = FString::Printf(TEXT("The sim is missing: %s"), *Script);
		return;
	}
	// hidden, not detached: it is ours, and it quits by itself when the socket closes
	Process = FPlatformProcess::CreateProc(TEXT("node"), *FString::Printf(TEXT("\"%s\" %d"), *Script, SimPort), false, true, true, nullptr, 0, nullptr, nullptr);
	Status = Process.IsValid() ? TEXT("Starting the sim...") : TEXT("Node.js was not found. Install Node 18 or newer, restart the editor, then press Play again.");
	UE_LOG(LogCrystalVein, Log, TEXT("Sim: node \"%s\" on port %d: %s"), *Script, SimPort, Process.IsValid() ? TEXT("started") : TEXT("could NOT be started"));
	bWanted = true; // even without our own process: a sidecar started by hand answers on the same port
	RetryIn = 0.35f;
	Tries = 0;
}

void FCVSimLink::Stop()
{
	CloseSocket();
	if (Process.IsValid())
	{
		FPlatformProcess::TerminateProc(Process);
		FPlatformProcess::CloseProc(Process);
	}
	bWanted = false;
}

void FCVSimLink::CloseSocket()
{
	if (Socket != nullptr)
	{
		Socket->Close();
		if (ISocketSubsystem* Subsystem = ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM))
		{
			Subsystem->DestroySocket(Socket);
		}
		Socket = nullptr;
	}
	bConnected = false;
	Inbox.Reset();
}

void FCVSimLink::BeginConnect()
{
	Socket = FTcpSocketBuilder(TEXT("CVSim")).AsNonBlocking().WithReceiveBufferSize(256 * 1024).Build();
	if (Socket == nullptr)
	{
		RetryIn = 1.f;
		return;
	}
	const FIPv4Endpoint Endpoint(FIPv4Address(127, 0, 0, 1), (uint16)SimPort);
	if (!Socket->Connect(*Endpoint.ToInternetAddr()))
	{
		CloseSocket();
		RetryIn = 0.5f;
		return;
	}
	Socket->SetNoDelay(true);
	Waited = 0.f;
}

bool FCVSimLink::Poll(float DeltaTime)
{
	Events.Reset();
	bNewSnap = false;

	if (Socket == nullptr)
	{
		RetryIn -= DeltaTime;
		if (bWanted && RetryIn <= 0.f)
		{
			BeginConnect();
		}
		return false;
	}
	if (!bConnected)
	{
		// a non-blocking connect is done when the socket turns writable; one that is refused never does
		if (Socket->Wait(ESocketWaitConditions::WaitForWrite, FTimespan::Zero()))
		{
			bConnected = true;
			Status.Reset();
			UE_LOG(LogCrystalVein, Log, TEXT("Sim: connected after %d tries"), Tries + 1);
		}
		else if ((Waited += DeltaTime) > 1.5f)
		{
			CloseSocket();
			RetryIn = 0.5f;
			if (++Tries > 6)
			{
				UE_CLOG(Tries == 7, LogCrystalVein, Warning, TEXT("Sim: no answer on port %d after %d tries"), SimPort, Tries);
				Status = TEXT("The sim is not answering. Is Node.js 18 or newer installed? Sim/sidecar.mjs can also be started by hand.");
			}
		}
		return false;
	}

	uint8 Buffer[16384];
	for (;;)
	{
		int32 Read = 0;
		if (!Socket->Recv(Buffer, (int32)sizeof(Buffer), Read))
		{
			CloseSocket();
			bWanted = false;
			Status = TEXT("The sim stopped. Press R to start it again.");
			UE_LOG(LogCrystalVein, Warning, TEXT("Sim: the connection closed"));
			return false;
		}
		if (Read <= 0)
		{
			break;
		}
		Inbox.Append(Buffer, Read);
	}

	int32 LineStart = 0;
	for (int32 Index = 0; Index < Inbox.Num(); ++Index)
	{
		if (Inbox[Index] == '\n')
		{
			HandleLine(FString::ConstructFromPtrSize((const UTF8CHAR*)(Inbox.GetData() + LineStart), Index - LineStart));
			LineStart = Index + 1;
		}
	}
	if (LineStart > 0)
	{
		Inbox.RemoveAt(0, LineStart);
	}
	if (Inbox.Num() > InboxLimit)
	{
		Inbox.Reset(); // no line of ours is this long
	}
	return bNewSnap;
}

void FCVSimLink::SendInput(int32 MoveX, int32 MoveY, int32 AimX, int32 AimY, int32 Bits, int32 Quick, bool bPause, bool bRestart, bool bBot)
{
	if (!IsConnected())
	{
		return;
	}
	// integers only: no decimal point for a locale to turn into a comma
	const FString Line = FString::Printf(TEXT("{\"x\":%d,\"y\":%d,\"ax\":%d,\"ay\":%d,\"b\":%d,\"q\":%d,\"pause\":%d,\"restart\":%d,\"bot\":%d}\n"),
		MoveX, MoveY, AimX, AimY, Bits, Quick, bPause ? 1 : 0, bRestart ? 1 : 0, bBot ? 1 : 0);
	const FTCHARToUTF8 Bytes(*Line);
	int32 Sent = 0;
	Socket->Send((const uint8*)Bytes.Get(), Bytes.Length(), Sent);
}

void FCVSimLink::HandleLine(const FString& Line)
{
	TSharedPtr<FJsonObject> Object;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Line), Object) || !Object.IsValid())
	{
		return;
	}
	FString Type;
	Object->TryGetStringField(TEXT("t"), Type);
	if (Type == TEXT("level"))
	{
		ReadLevel(Object);
	}
	else if (Type == TEXT("snap"))
	{
		ReadSnap(Object);
	}
}

void FCVSimLink::ReadLevel(const TSharedPtr<FJsonObject>& Object)
{
	FCVLevel Next;
	Object->TryGetNumberField(TEXT("w"), Next.W);
	Object->TryGetNumberField(TEXT("h"), Next.H);
	Object->TryGetNumberField(TEXT("tile"), Next.TileSize);
	Object->TryGetNumberField(TEXT("hp"), Next.MaxHealth);
	Object->TryGetNumberField(TEXT("stamina"), Next.MaxStamina);
	const FJsonArray& Tiles = ArrayOf(Object, TEXT("tiles"));
	Next.Tiles.Reserve(Tiles.Num());
	for (int32 Index = 0; Index < Tiles.Num(); ++Index)
	{
		Next.Tiles.Add((uint8)NumberAt(Tiles, Index));
	}
	for (const TSharedPtr<FJsonValue>& Value : ArrayOf(Object, TEXT("lamps")))
	{
		const FJsonArray& Fields = ArrayOf(Value);
		FCVLamp& Lamp = Next.Lamps.AddDefaulted_GetRef();
		Lamp.Pos = FVector2D(NumberAt(Fields, 0), NumberAt(Fields, 1));
		Lamp.Radius = (float)NumberAt(Fields, 2);
		Lamp.bAlways = NumberAt(Fields, 3) != 0.0;
	}
	for (const TSharedPtr<FJsonValue>& Value : ArrayOf(Object, TEXT("things")))
	{
		const FJsonArray& Fields = ArrayOf(Value);
		FCVThing& Thing = Next.Things.AddDefaulted_GetRef();
		Thing.Kind = StringAt(Fields, 0);
		Thing.Tile = FIntPoint((int32)NumberAt(Fields, 1), (int32)NumberAt(Fields, 2));
	}
	if (!Next.IsValid())
	{
		UE_LOG(LogCrystalVein, Warning, TEXT("The sim sent a level that does not add up (%d x %d, %d tiles); ignored."), Next.W, Next.H, Next.Tiles.Num());
		return;
	}
	Level = MoveTemp(Next);
	Snap = FCVSnap();
	bLevelChanged = true;
	bLoggedSnap = false;
	UE_LOG(LogCrystalVein, Log, TEXT("Sim: level %d x %d, %d lamps, %d things"), Level.W, Level.H, Level.Lamps.Num(), Level.Things.Num());
}

void FCVSimLink::ReadSnap(const TSharedPtr<FJsonObject>& Object)
{
	const FJsonArray& Player = ArrayOf(Object, TEXT("p"));
	if (!Level.IsValid() || Player.Num() < 6)
	{
		return;
	}
	FCVSnap Next;
	Object->TryGetNumberField(TEXT("tick"), Next.Tick);
	Next.Pos = FVector2D(NumberAt(Player, 0), NumberAt(Player, 1));
	Next.Aim = (float)NumberAt(Player, 2);
	Next.Health = (float)NumberAt(Player, 3);
	Next.Stamina = (float)NumberAt(Player, 4);
	Next.Flags = (int32)NumberAt(Player, 5);

	const FJsonArray& Light = ArrayOf(Object, TEXT("l"));
	Next.bLightOn = NumberAt(Light, 0) != 0.0;
	Next.LightIntensity = (float)NumberAt(Light, 1);
	Next.bLightDead = NumberAt(Light, 2) != 0.0;

	for (const TSharedPtr<FJsonValue>& Value : ArrayOf(Object, TEXT("a")))
	{
		const FJsonArray& Fields = ArrayOf(Value);
		FCVAlien& Alien = Next.Aliens.AddDefaulted_GetRef();
		Alien.Id = (int32)NumberAt(Fields, 0);
		Alien.Type = StringAt(Fields, 1);
		Alien.Pos = FVector2D(NumberAt(Fields, 2), NumberAt(Fields, 3));
		Alien.Facing = (float)NumberAt(Fields, 4);
		Alien.Flags = (int32)NumberAt(Fields, 6);
		Alien.Radius = FMath::Max(1.f, (float)NumberAt(Fields, 7));
	}
	for (const TSharedPtr<FJsonValue>& Value : ArrayOf(Object, TEXT("c")))
	{
		const FJsonArray& Fields = ArrayOf(Value);
		Next.Corpses.Add(FVector2D(NumberAt(Fields, 1), NumberAt(Fields, 2)));
	}
	for (const TSharedPtr<FJsonValue>& Value : ArrayOf(Object, TEXT("it")))
	{
		const FJsonArray& Fields = ArrayOf(Value);
		FCVItem& Item = Next.Items.AddDefaulted_GetRef();
		Item.Pos = FVector2D(NumberAt(Fields, 0), NumberAt(Fields, 1));
		Item.Name = StringAt(Fields, 2);
	}
	const FJsonArray& Loot = ArrayOf(Object, TEXT("loot"));
	for (int32 Index = 0; Index < Loot.Num(); ++Index)
	{
		Next.Loot.Add((int32)NumberAt(Loot, Index));
	}
	const FJsonArray& Fires = ArrayOf(Object, TEXT("fires"));
	for (int32 Index = 0; Index < Fires.Num(); ++Index)
	{
		Next.Fires.Add((int32)NumberAt(Fires, Index));
	}
	// tile changes: index, tile pairs
	const FJsonArray& Changed = ArrayOf(Object, TEXT("td"));
	for (int32 Index = 0; Index + 1 < Changed.Num(); Index += 2)
	{
		const int32 TileIndex = (int32)NumberAt(Changed, Index);
		if (Level.Tiles.IsValidIndex(TileIndex))
		{
			Level.Tiles[TileIndex] = (uint8)NumberAt(Changed, Index + 1);
			bTilesChanged = true;
		}
	}
	const FJsonArray& Quick = ArrayOf(Object, TEXT("q"));
	for (int32 Index = 0; Index < Quick.Num(); ++Index)
	{
		Next.Quick.Add(StringAt(Quick, Index));
	}
	for (const TSharedPtr<FJsonValue>& Value : ArrayOf(Object, TEXT("ev")))
	{
		const FJsonArray& Fields = ArrayOf(Value);
		if (Fields.Num() > 0)
		{
			FCVEvent& Event = Events.AddDefaulted_GetRef();
			Event.Kind = StringAt(Fields, 0);
			for (int32 Index = 1; Index < Fields.Num(); ++Index)
			{
				Event.Args.Add(StringAt(Fields, Index));
			}
		}
	}
	int32 Power = 0;
	Object->TryGetNumberField(TEXT("power"), Power);
	Next.bPower = Power != 0;
	Object->TryGetNumberField(TEXT("ch"), Next.Channel);
	Object->TryGetStringField(TEXT("msg"), Next.Message);
	Object->TryGetStringField(TEXT("obj"), Next.Objective);
	Object->TryGetStringField(TEXT("prompt"), Next.Prompt);
	Object->TryGetStringField(TEXT("room"), Next.Room);
	Object->TryGetStringField(TEXT("cause"), Next.Cause);
	Object->TryGetStringField(TEXT("w"), Next.Weapon);

	Snap = MoveTemp(Next);
	bNewSnap = true;
	if (!bLoggedSnap)
	{
		bLoggedSnap = true;
		UE_LOG(LogCrystalVein, Log, TEXT("Sim: first snapshot, tick %d, player at %.0f, %.0f in '%s'"), Snap.Tick, Snap.Pos.X, Snap.Pos.Y, *Snap.Room);
	}
}
