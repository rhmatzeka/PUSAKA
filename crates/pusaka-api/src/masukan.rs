//! Extractor yang mengubah penolakan axum (teks biasa) menjadi `Galat` JSON.

use axum::Json;
use axum::extract::{FromRequest, FromRequestParts, Query, Request};
use axum::http::request::Parts;
use serde::de::DeserializeOwned;
use uuid::Uuid;

use crate::galat::Galat;

/// Badan JSON; galat urai → 400 INPUT_TIDAK_VALID.
pub struct JsonMasuk<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequest<S> for JsonMasuk<T> {
    type Rejection = Galat;

    async fn from_request(req: Request, state: &S) -> Result<Self, Galat> {
        match Json::<T>::from_request(req, state).await {
            Ok(Json(isi)) => Ok(Self(isi)),
            Err(e) => Err(Galat::InputTidakValid(e.body_text())),
        }
    }
}

/// Parameter query; galat urai → 400 INPUT_TIDAK_VALID.
pub struct QueryMasuk<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequestParts<S> for QueryMasuk<T> {
    type Rejection = Galat;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Galat> {
        Query::<T>::try_from_uri(&parts.uri)
            .map(|Query(isi)| Self(isi))
            .map_err(|e| Galat::InputTidakValid(e.body_text()))
    }
}

pub fn id_dari(s: &str) -> Result<Uuid, Galat> {
    Uuid::parse_str(s).map_err(|_| Galat::InputTidakValid("id harus UUID".into()))
}

pub fn token_dari(s: &str) -> Result<u64, Galat> {
    s.parse::<u64>()
        .ok()
        .filter(|t| i64::try_from(*t).is_ok())
        .ok_or_else(|| Galat::InputTidakValid("token_id harus bilangan bulat positif".into()))
}
