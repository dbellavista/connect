from invoke.collection import Collection

from connect import pdf, youtube

ns = Collection()
ns.add_collection(ns.from_module(pdf))
ns.add_collection(ns.from_module(youtube))
