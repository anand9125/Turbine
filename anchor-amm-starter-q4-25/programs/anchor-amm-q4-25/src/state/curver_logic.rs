use anchor_lang::prelude::*;
use crate::errors::AmmError;

#[derive(Clone, Copy)]
pub enum LiquidityPair {
    X,
    Y,
}

pub struct SwapResult {
    pub deposit: u64,
    pub fee: u64,
    pub withdraw: u64,
}

pub struct ConstantProduct {
    pub x: u64,
    pub y: u64,
    pub fee: u64, // basis points
}

impl ConstantProduct {
    pub fn swap(
        &mut self,
        pair: LiquidityPair,
        amount_in: u64,
        min_out: u64,
    ) -> Result<SwapResult> {
        // apply fee
        let amount_after_fee = (amount_in as u128)
            .checked_mul((10_000 - self.fee) as u128)
            .ok_or(AmmError::Overflow)?
            .checked_div(10_000)
            .ok_or(AmmError::Overflow)? as u64;

        let (new_x, new_y, amount_out) = match pair {
            LiquidityPair::X => {
                let x2 = self.x.checked_add(amount_after_fee).ok_or(AmmError::Overflow)?;
                let k = (self.x as u128)
                    .checked_mul(self.y as u128)
                    .ok_or(AmmError::Overflow)?;
                let y2 = (k / x2 as u128) as u64;
                let dy = self.y.checked_sub(y2).ok_or(AmmError::Underflow)?;
                (x2, y2, dy)
            }
            LiquidityPair::Y => {
                let y2 = self.y.checked_add(amount_after_fee).ok_or(AmmError::Overflow)?;
                let k = (self.x as u128)
                    .checked_mul(self.y as u128)
                    .ok_or(AmmError::Overflow)?;
                let x2 = (k / y2 as u128) as u64;
                let dx = self.x.checked_sub(x2).ok_or(AmmError::Underflow)?;
                (x2, y2, dx)
            }
        };

        require!(amount_out >= min_out, AmmError::SlippageExceeded);

        let fee = amount_in.checked_sub(amount_after_fee).ok_or(AmmError::Underflow)?;

        self.x = new_x;
        self.y = new_y;

        Ok(SwapResult {
            deposit: amount_in,
            fee,
            withdraw: amount_out,
        })
    }
}
