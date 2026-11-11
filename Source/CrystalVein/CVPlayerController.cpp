#include "CVPlayerController.h"
#include "CrystalVein.h"
#include "CVPawn.h"
#include "CVWorldView.h"
#include "SCVHud.h"
#include "Engine/GameViewportClient.h"
#include "Engine/LocalPlayer.h"
#include "Engine/World.h"
#include "InputCoreTypes.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "UnrealClient.h"

namespace
{
	// input.ts's BITS, in order
	namespace ECVButton
	{
		enum { Sprint = 1 << 0, Crouch = 1 << 1, Fire = 1 << 2, Light = 1 << 3, Interact = 1 << 4, Vault = 1 << 5, Reload = 1 << 6, Swap = 1 << 7, Drop = 1 << 8 };
	}

	const double StickDeadZone = 0.28;
	const double PadAimPx = 80.0; // how far ahead the pad aims, in sim px (five tiles)
	const TCHAR* const KeysHint = TEXT("WASD move    Shift sprint    Ctrl crouch\nMouse aim    Left click strike    E use\nF light    Space vault    1-4 quick slots");
	const TCHAR* const PadHint = TEXT("Left stick move    LT sprint    Right stick aim\nRT strike    A use    Y light    B vault\nD-pad quick slots");
}

ACVPlayerController::ACVPlayerController()
{
	bShowMouseCursor = true; // the cursor is the aim
}

void ACVPlayerController::BeginPlay()
{
	Super::BeginPlay();
	if (!IsLocalController())
	{
		return;
	}
	FInputModeGameAndUI Mode;
	Mode.SetHideCursorDuringCapture(false);
	Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
	SetInputMode(Mode);

	bDemo = FParse::Param(FCommandLine::Get(), TEXT("CVDemo"));
	if (bDemo)
	{
		ShotEvery = 3.f;
		UE_LOG(LogCrystalVein, Log, TEXT("Demo run: the sim's bot plays; the game quits by itself"));
	}
	WorldView = GetWorld()->SpawnActor<ACVWorldView>();
	SAssignNew(Hud, SCVHud);
	if (const ULocalPlayer* LocalPlayer = GetLocalPlayer(); LocalPlayer != nullptr && LocalPlayer->ViewportClient != nullptr)
	{
		LocalPlayer->ViewportClient->AddViewportWidgetContent(Hud.ToSharedRef(), 10);
	}
	Link.Start();
}

void ACVPlayerController::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	Link.Stop();
	if (Hud.IsValid())
	{
		if (const ULocalPlayer* LocalPlayer = GetLocalPlayer(); LocalPlayer != nullptr && LocalPlayer->ViewportClient != nullptr)
		{
			LocalPlayer->ViewportClient->RemoveViewportWidgetContent(Hud.ToSharedRef());
		}
		Hud.Reset();
	}
	Super::EndPlay(EndPlayReason);
}

bool ACVPlayerController::PressedAny(std::initializer_list<FKey> Keys) const
{
	for (const FKey& Key : Keys)
	{
		if (WasInputKeyJustPressed(Key))
		{
			return true;
		}
	}
	return false;
}

bool ACVPlayerController::HeldAny(std::initializer_list<FKey> Keys) const
{
	for (const FKey& Key : Keys)
	{
		if (IsInputKeyDown(Key))
		{
			return true;
		}
	}
	return false;
}

FVector2D ACVPlayerController::ScreenToDeck(const FVector2D& OnScreen) const
{
	// sim x, y are world X, Y. Up on the screen is the way the camera looks along the floor; right is a quarter turn on from it.
	const ACVPawn* Body = Cast<ACVPawn>(GetPawn());
	const double Yaw = FMath::DegreesToRadians(Body != nullptr ? (double)Body->CameraYaw : -45.0);
	const FVector2D Up(FMath::Cos(Yaw), FMath::Sin(Yaw));
	const FVector2D Right(-FMath::Sin(Yaw), FMath::Cos(Yaw));
	return Right * OnScreen.X + Up * OnScreen.Y;
}

void ACVPlayerController::OpenPanel(EPanel Kind, const FString& Title, const FString& Body)
{
	if (!Hud.IsValid())
	{
		return;
	}
	Panel = Kind;
	PanelOpenedAt = (float)GetWorld()->GetTimeSeconds();
	Hud->State.PanelTitle = Title;
	Hud->State.PanelBody = Body;
}

void ACVPlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);
	if (!Hud.IsValid() || WorldView == nullptr)
	{
		return;
	}
	const float Now = (float)GetWorld()->GetTimeSeconds();

	// 1. what the sim sent
	Link.Poll(DeltaTime);
	if (Link.bLevelChanged)
	{
		Link.bLevelChanged = false;
		Link.bTilesChanged = false;
		WorldView->Build(Link.Level);
		Panel = EPanel::None;
		Whisper.Reset();
		HintUntil = Now + 30.f;
		bSnapNext = true;
		NextShotAt = Now + (bDemo ? 3.f : 2.f);
		SurveyUntil = bDemo ? Now + 1.6f : -1.f;
		bSurveyShot = false;
	}
	if (Link.bTilesChanged)
	{
		Link.bTilesChanged = false;
		WorldView->RefreshTiles(Link.Level);
	}
	for (const FCVEvent& Event : Link.Events)
	{
		UE_LOG(LogCrystalVein, Log, TEXT("Event: %s"), *Event.Kind);
		if ((Event.Kind == TEXT("note") || Event.Kind == TEXT("view")) && Event.Args.Num() >= 2)
		{
			OpenPanel(EPanel::Note, Event.Args[0], Event.Args[1]);
		}
		else if (Event.Kind == TEXT("power"))
		{
			WorldView->PowerUp();
		}
		else if (Event.Kind == TEXT("whisper") && Event.Args.Num() >= 1)
		{
			Whisper = Event.Args[0];
			WhisperUntil = Now + 9.f;
		}
		else if (Event.Kind == TEXT("done"))
		{
			OpenPanel(EPanel::Done, TEXT("Section clear"), TEXT("Cargo and Maintenance is behind you.\n\nThe crew quarters are not built yet."));
		}
	}

	// 2. show it
	const FCVSnap& Snap = Link.Snap;
	const bool bPlaying = Link.IsConnected() && Link.Level.IsValid() && Snap.Tick >= 0;
	if (bPlaying)
	{
		WorldView->Apply(Link.Level, Snap);
		const bool bSurvey = Now < SurveyUntil;
		WorldView->SetSurveyLight(bSurvey);
		if (ACVPawn* Body = Cast<ACVPawn>(GetPawn()))
		{
			Body->ShowSnap(Snap, WorldView->GetUnitsPerPx(), DeltaTime, bSnapNext || bSurvey);
			bSnapNext = false;
			if (bSurvey)
			{
				// straight down on the whole deck, lit flat; the distance fits it into a 30 degree lens at 16:9
				const double HalfW = Link.Level.W * 50.0 + 100.0;
				const double HalfH = Link.Level.H * 50.0 + 100.0;
				Body->ShowOverview(FVector(Link.Level.W * 50.0, Link.Level.H * 50.0, 0.0), (float)FMath::Max(HalfW / 0.268, HalfH / 0.1507));
			}
		}
		if (!Snap.Has(ECVFlag::Alive) && Panel == EPanel::None)
		{
			OpenPanel(EPanel::Dead, TEXT("You died"), Snap.Cause.IsEmpty() ? FString(TEXT("The dark took you.")) : Snap.Cause + TEXT("."));
		}
	}

#if !UE_BUILD_SHIPPING
	// How Claude sees the game: every few seconds the game view goes to Saved/DevLoop as a PNG, with a line of numbers in the log.
	SmoothedFps = FMath::Lerp(SmoothedFps, DeltaTime > 0.f ? 1.f / DeltaTime : 0.f, 0.1f);
	if (bPlaying && !bSurveyShot && Now < SurveyUntil && Now >= SurveyUntil - 0.5f)
	{
		bSurveyShot = true;
		FScreenshotRequest::RequestScreenshot(FPaths::ConvertRelativePathToFull(FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("DevLoop"), TEXT("shot_map.png"))), true, false, false, FIntRect(), true);
	}
	if (bPlaying && ShotEvery > 0.f && Now >= NextShotAt)
	{
		NextShotAt = Now + ShotEvery;
		const int32 Slot = ShotIndex++ % 40;
		const FString ShotPath = FPaths::ConvertRelativePathToFull(FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("DevLoop"), FString::Printf(TEXT("shot_%02d.png"), Slot)));
		FScreenshotRequest::RequestScreenshot(ShotPath, true, false, false, FIntRect(), true);
		UE_LOG(LogCrystalVein, Log, TEXT("shot_%02d: tick %d, %.0f fps, room '%s', objective '%s', hp %.0f, light %d x %.2f dead %d, power %d, aliens %d, fires %d, panel %d, pad %d"),
			Slot, Snap.Tick, SmoothedFps, *Snap.Room, *Snap.Objective, Snap.Health, Snap.bLightOn ? 1 : 0, Snap.LightIntensity, Snap.bLightDead ? 1 : 0, Snap.bPower ? 1 : 0,
			Snap.Aliens.Num(), Snap.Fires.Num(), (int32)Panel, bUsingPad ? 1 : 0);
	}
#endif

	// The demo run looks after itself: a note closes after three seconds, the end of the run or four minutes ends the game.
	if (bDemo)
	{
		if (Panel == EPanel::Note && Now - PanelOpenedAt > 3.f)
		{
			Panel = EPanel::None;
		}
		if (bPlaying && DemoStartedAt < 0.f)
		{
			DemoStartedAt = Now;
		}
		if ((Panel == EPanel::Done || Panel == EPanel::Dead) && DemoQuitAt < 0.f)
		{
			DemoQuitAt = Now + 4.f;
		}
		const bool bOver = DemoQuitAt >= 0.f && Now >= DemoQuitAt;
		const bool bTooLong = DemoStartedAt >= 0.f && Now - DemoStartedAt > 240.f;
		const bool bNoSim = DemoStartedAt < 0.f && Now > 90.f;
		if (bOver || bTooLong || bNoSim)
		{
			UE_LOG(LogCrystalVein, Log, TEXT("Demo run ends: %s"), bOver ? TEXT("the section is over") : bTooLong ? TEXT("four minutes are up") : TEXT("the sim never answered"));
			FPlatformMisc::RequestExit(false);
			return;
		}
	}

	// 3. the player's input: which device, where to, aimed at what
	const FVector2D LeftStick(GetInputAnalogKeyState(EKeys::Gamepad_LeftX), GetInputAnalogKeyState(EKeys::Gamepad_LeftY));
	const FVector2D RightStick(GetInputAnalogKeyState(EKeys::Gamepad_RightX), GetInputAnalogKeyState(EKeys::Gamepad_RightY));
	FVector2D Mouse = FVector2D::ZeroVector;
	const bool bHasMouse = GetMousePosition(Mouse.X, Mouse.Y);
	if (LeftStick.Size() > StickDeadZone || RightStick.Size() > StickDeadZone)
	{
		bUsingPad = true;
	}
	else if (bHasMouse && !Mouse.Equals(LastMouse, 0.5))
	{
		bUsingPad = false;
	}
	if (bHasMouse)
	{
		LastMouse = Mouse;
	}
	SetShowMouseCursor(!bUsingPad);

	FVector2D OnScreen((HeldAny({ EKeys::D, EKeys::Right }) ? 1.0 : 0.0) - (HeldAny({ EKeys::A, EKeys::Left }) ? 1.0 : 0.0),
		(HeldAny({ EKeys::W, EKeys::Up }) ? 1.0 : 0.0) - (HeldAny({ EKeys::S, EKeys::Down }) ? 1.0 : 0.0));
	if (LeftStick.Size() > StickDeadZone)
	{
		OnScreen = LeftStick;
	}
	FVector2D Move = ScreenToDeck(OnScreen);
	if (Move.SizeSquared() > 1.0)
	{
		Move = Move.GetSafeNormal();
	}

	FVector2D AimOffset = AimDir * PadAimPx;
	if (!bUsingPad)
	{
		FVector Origin = FVector::ZeroVector;
		FVector Direction = FVector::ZeroVector;
		if (bPlaying && DeprojectMousePositionToWorld(Origin, Direction) && Direction.Z < -UE_KINDA_SMALL_NUMBER)
		{
			const FVector OnFloor = Origin + Direction * (-Origin.Z / Direction.Z); // where the cursor meets the deck
			AimOffset = FVector2D(OnFloor.X, OnFloor.Y) / WorldView->GetUnitsPerPx() - Snap.Pos;
		}
	}
	else if (RightStick.Size() > StickDeadZone)
	{
		AimOffset = ScreenToDeck(RightStick).GetSafeNormal() * PadAimPx;
	}
	else if (Move.SizeSquared() > 0.04)
	{
		AimOffset = Move.GetSafeNormal() * PadAimPx; // no aim on the stick: face the way you walk
	}
	if (!AimOffset.IsNearlyZero())
	{
		AimDir = AimOffset.GetSafeNormal();
	}

	// 4. buttons. A panel takes them: a note is closed with the use key, a finished run starts again with R.
	int32 Bits = 0;
	int32 Quick = -1;
	bool bRestart = false;
	if (bDemo)
	{
		// the bot has the controls
	}
	else if (Panel == EPanel::Note)
	{
		if (PressedAny({ EKeys::E, EKeys::Enter, EKeys::SpaceBar, EKeys::Gamepad_FaceButton_Bottom, EKeys::Gamepad_FaceButton_Right }))
		{
			Panel = EPanel::None;
		}
	}
	else if (Panel == EPanel::Dead || Panel == EPanel::Done)
	{
		if (PressedAny({ EKeys::R, EKeys::Enter, EKeys::Gamepad_FaceButton_Bottom }))
		{
			bRestart = true;
			Panel = EPanel::None;
		}
	}
	else
	{
		Bits |= HeldAny({ EKeys::LeftShift, EKeys::Gamepad_LeftTrigger }) ? ECVButton::Sprint : 0;
		Bits |= HeldAny({ EKeys::LeftControl, EKeys::C, EKeys::Gamepad_RightThumbstick }) ? ECVButton::Crouch : 0;
		Bits |= HeldAny({ EKeys::LeftMouseButton, EKeys::Gamepad_RightTrigger }) ? ECVButton::Fire : 0;
		Bits |= PressedAny({ EKeys::F, EKeys::Gamepad_FaceButton_Top }) ? ECVButton::Light : 0;
		Bits |= PressedAny({ EKeys::E, EKeys::Gamepad_FaceButton_Bottom }) ? ECVButton::Interact : 0;
		Bits |= PressedAny({ EKeys::SpaceBar, EKeys::Gamepad_FaceButton_Right }) ? ECVButton::Vault : 0;
		Bits |= PressedAny({ EKeys::R, EKeys::Gamepad_FaceButton_Left }) ? ECVButton::Reload : 0;
		Bits |= PressedAny({ EKeys::Q, EKeys::Gamepad_RightShoulder }) ? ECVButton::Swap : 0;
		Bits |= PressedAny({ EKeys::X }) ? ECVButton::Drop : 0;
		Quick = PressedAny({ EKeys::One, EKeys::Gamepad_DPad_Up }) ? 0 : PressedAny({ EKeys::Two, EKeys::Gamepad_DPad_Right }) ? 1
			: PressedAny({ EKeys::Three, EKeys::Gamepad_DPad_Down }) ? 2 : PressedAny({ EKeys::Four, EKeys::Gamepad_DPad_Left }) ? 3 : -1;
	}
	if (!Link.IsWanted() && PressedAny({ EKeys::R, EKeys::Gamepad_FaceButton_Bottom }))
	{
		Link.Start(); // the sim stopped: start it again
	}
	// the wire form's units (input.ts): move -127..127, aim in quarter px. A note pauses the sim; nothing else does.
	Link.SendInput(FMath::RoundToInt32(Move.X * 127.0), FMath::RoundToInt32(Move.Y * 127.0),
		FMath::Clamp(FMath::RoundToInt32(AimOffset.X * 4.0), -32767, 32767), FMath::Clamp(FMath::RoundToInt32(AimOffset.Y * 4.0), -32767, 32767),
		Bits, Quick, Panel == EPanel::Note, bRestart, bDemo);

	// 5. the HUD
	FCVHudState& Shown = Hud->State;
	const TCHAR* const UseKey = bUsingPad ? TEXT("(A)  ") : TEXT("[E]  ");
	Shown.bPlaying = bPlaying;
	Shown.Status = bPlaying ? FString() : Link.Status.IsEmpty() ? FString(TEXT("Waiting for the sim...")) : Link.Status;
	if (!Snap.Room.IsEmpty())
	{
		LastRoom = Snap.Room; // a doorway belongs to no room: keep the name of the one you left
	}
	Shown.Room = bPlaying ? LastRoom : FString();
	Shown.Objective = bPlaying ? Snap.Objective : FString();
	// A dead light is the one thing to do: it takes the prompt line, with this device's button. The sim's own line names a key, so it is dropped.
	const bool bSmack = bPlaying && Panel == EPanel::None && Snap.bLightDead && Snap.Has(ECVFlag::Alive);
	Shown.Message = bPlaying && Panel == EPanel::None && !(bSmack && Snap.Message.Contains(TEXT("mash F"))) ? Snap.Message : FString();
	Shown.Whisper = bPlaying && Now < WhisperUntil ? Whisper : FString();
	Shown.Prompt = bSmack ? FString(bUsingPad ? TEXT("(Y)  ") : TEXT("[F]  ")) + TEXT("Your light is dead. Smack it: press again and again")
		: bPlaying && Panel == EPanel::None && !Snap.Prompt.IsEmpty() ? UseKey + Snap.Prompt : FString();
	Shown.Weapon = Snap.Weapon.IsEmpty() ? FString(TEXT("bare hands")) : Snap.Weapon;
	Shown.Quick.Reset();
	for (int32 Index = 0; Index < Snap.Quick.Num(); ++Index)
	{
		if (!Snap.Quick[Index].IsEmpty())
		{
			Shown.Quick += FString::Printf(TEXT("%d %s    "), Index + 1, *Snap.Quick[Index]);
		}
	}
	Shown.Health = Snap.Health;
	Shown.MaxHealth = Link.Level.MaxHealth;
	Shown.Stamina = Snap.Stamina;
	Shown.MaxStamina = Link.Level.MaxStamina;
	Shown.Channel = Snap.Channel;
	Shown.Hint = bPlaying && Now < HintUntil ? FString(bUsingPad ? PadHint : KeysHint) : FString();
	Shown.bPanel = Panel != EPanel::None;
	Shown.PanelHint = Panel == EPanel::Note ? UseKey + FString(TEXT("Close")) : (bUsingPad ? TEXT("(A)  ") : TEXT("[R]  ")) + FString(TEXT("Start the section again"));
}
