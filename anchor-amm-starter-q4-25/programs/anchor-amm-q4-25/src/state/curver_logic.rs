use anchor_lang::prelude::*;
use crate::{errors::AmmError, state::Config};

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
    // Swap asset X for asset Y or vice versa with slippage protection
    pub fn swap(
        &mut self,
        p: LiquidityPair,
        a: u64,
        min: u64,
    ) -> Result<SwapResult> {
        // apply fee
        let a2 = (a as u128)
            .checked_mul((10_000 - self.fee) as u128)
            .ok_or_else(|| anchor_lang::error::Error::from(AmmError::Overflow))?
            .checked_div(10_000)
            .ok_or_else(|| anchor_lang::error::Error::from(AmmError::Overflow))? as u64;

        let (new_x, new_y, withdraw) = match p {
            LiquidityPair::X => {
                let x2 = self.x.checked_add(a2).ok_or_else(|| anchor_lang::error::Error::from(AmmError::Overflow))?;
                let y2 = Self::y2_from_x_swap_amount(self.x, self.y, a2)?;
                let delta_y =
                    Self::delta_y_from_x_swap_amount(self.x, self.y, a2)?;
                (x2, y2, delta_y)
            }
            LiquidityPair::Y => {
                let y2 = self.y.checked_add(a2).ok_or_else(|| anchor_lang::error::Error::from(AmmError::Overflow))?;
                let x2 = Self::x2_from_y_swap_amount(self.x, self.y, a2)?;
                let delta_x =
                    Self::delta_x_from_y_swap_amount(self.x, self.y, a2)?;
                (x2, y2, delta_x)
            }
        };

        require!(withdraw >= min, AmmError::SlippageExceeded);

        let fee = a.checked_sub(a2).ok_or_else(|| anchor_lang::error::Error::from(AmmError::Underflow))?;;

        self.x = new_x;
        self.y = new_y;

        Ok(SwapResult {
            deposit: a,
            fee,
            withdraw,
        })
    }

    // ----- math helpers -----

    fn y2_from_x_swap_amount(x: u64, y: u64, dx: u64) -> Result<u64> {
        let k = (x as u128)
            .checked_mul(y as u128)
            .ok_or_else(|| anchor_lang::error::Error::from(AmmError::Overflow))?;
        let x2 = x.checked_add(dx).ok_or_else(|| anchor_lang::error::Error::from(AmmError::Overflow))? as u128;
        Ok((k / x2) as u64)
    }

    fn delta_y_from_x_swap_amount(
        x: u64,
        y: u64,
        dx: u64,
    ) -> Result<u64> {
        let y2 = Self::y2_from_x_swap_amount(x, y, dx)?;
        y.checked_sub(y2).ok_or_else(|| anchor_lang::error::Error::from(AmmError::Underflow))
    }

    fn x2_from_y_swap_amount(x: u64, y: u64, dy: u64) -> Result<u64> {
        let k = (x as u128)
            .checked_mul(y as u128)
            .ok_or_else(|| anchor_lang::error::Error::from(AmmError::Overflow))?;
        let y2 = y.checked_add(dy).ok_or_else(|| anchor_lang::error::Error::from(AmmError::Overflow))? as u128;
        Ok((k / y2) as u64)
    }

    fn delta_x_from_y_swap_amount(
        x: u64,
        y: u64,
        dy: u64,
    ) -> Result<u64> {
        let x2 = Self::x2_from_y_swap_amount(x, y, dy)?;
        x.checked_sub(x2).ok_or_else(|| anchor_lang::error::Error::from(AmmError::Underflow))
    }
}
