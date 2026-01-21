use anchor_lang::prelude::*;

declare_id!("9EQ7GDtaNTABr8LGtjhhinixu6BBeNLJuZYUgumAphE");

#[program]
pub mod test_hello_world {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
