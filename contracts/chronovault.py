from pyteal import *

# --- State ---
creator_key = Bytes("Creator")
beneficiary_key = Bytes("Beneficiary")
unlock_time_key = Bytes("UnlockTime")
ipfs_hash_key = Bytes("IPFSHash")
is_unlocked_key = Bytes("IsUnlocked")  # 0=Locked, 1=Unlocked

# --- Operations ---
op_configure = Bytes("configure")
op_unlock = Bytes("unlock")


def approval_program():
    """
    ChronoVault Smart Contract Logic.
    
    1. Creation -> Set Creator, Locked=0, Timestamp=0
    2. Configure -> Set Creator only, Check not already configured -> Set UnlockTime, Beneficiary, Hash.
    3. Unlock -> Check Timestamp >= UnlockTime -> Set IsUnlocked=1
    """

    # 1. Handle Creation
    on_creation = Seq([
        App.globalPut(creator_key, Txn.sender()),
        App.globalPut(beneficiary_key, Txn.sender()), 
        App.globalPut(unlock_time_key, Int(0)), # Not configured
        App.globalPut(is_unlocked_key, Int(0)),
        App.globalPut(ipfs_hash_key, Bytes("")),
        Approve()
    ])

    # 2. Configure Logic
    # Args: [op_name, unlock_timestamp (int), beneficiary (account_index), ipfs_hash (bytes)]
    # Note: 'beneficiary' is passed as an account index (Txn.accounts[1])
    configure = Seq([
        Assert(Txn.sender() == App.globalGet(creator_key)),
        Assert(App.globalGet(unlock_time_key) == Int(0)), # Ensure not already configured

        # Store critical state
        App.globalPut(unlock_time_key, Btoi(Txn.application_args[1])),
        App.globalPut(beneficiary_key, Txn.accounts[1]),
        App.globalPut(ipfs_hash_key, Txn.application_args[2]),

        Approve()
    ])

    # 3. Unlock Logic
    # Checks: standard Time-Lock check
    unlock = Seq([
        Assert(Global.latest_timestamp() >= App.globalGet(unlock_time_key)),
        # If passed, set state to Unlocked
        App.globalPut(is_unlocked_key, Int(1)),
        Approve()
    ])

    # 4. Handle Deletion (Reclaims Storage Cost)
    on_delete = Seq([
        Assert(Txn.sender() == App.globalGet(creator_key)),
        Approve()
    ])

    # Main Routing
    program = Cond(
        [Txn.application_id() == Int(0), on_creation],
        [Txn.on_completion() == OnComplete.DeleteApplication, on_delete],
        [Txn.on_completion() == OnComplete.UpdateApplication, Reject()], # Disallow updates for security
        [Txn.on_completion() == OnComplete.CloseOut, Approve()],
        [Txn.on_completion() == OnComplete.OptIn, Approve()],
        # Application Calls
        [Txn.application_args[0] == op_configure, configure],
        [Txn.application_args[0] == op_unlock, unlock]
    )

    return compileTeal(program, Mode.Application, version=6)

def clear_state_program():
    return compileTeal(Approve(), Mode.Application, version=6)

if __name__ == "__main__":
    with open("contracts/approval.teal", "w") as f:
        f.write(approval_program())

    with open("contracts/clear.teal", "w") as f:
        f.write(clear_state_program())

    print("Contracts compiled successfully.")
