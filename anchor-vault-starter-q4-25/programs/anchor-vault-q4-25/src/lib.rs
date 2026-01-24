use anchor_lang::prelude::*;

pub mod instructions;
pub use instructions::*;

declare_id!("3BXaLDkByp2xTpvZAhPkbesbJbuzSYCUKdDPbM2Q98BC");

#[program]
pub mod anchor_vault_q4_25 {

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)
    }

    pub fn deposit(ctx:Context<Deposit> , amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)
    }

     pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)
    }

     pub fn close(ctx: Context<Close>) -> Result<()> {
        ctx.accounts.close()
    }
}






#[derive(InitSpace)]
#[account]
pub struct VaultState {
    pub vault_bump: u8,
    pub state_bump: u8,
}
