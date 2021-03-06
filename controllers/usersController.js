const User = require('../models/User');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const jwt = require('jsonwebtoken');

exports.mustBeLoggedIn = (req, res, next) => {
    if (req.session.user) {
        next()
    } else {
        req.flash('errors', 'you mucst be logged in to perform that action')
        req.session.save(() => { res.redirect('/') })
    }
}

exports.apimustBeLoggedIn = (req, res, next) => {
    try {
        req.apiUser = jwt.verify(req.body.token, process.env.JWTSECRET)
        next()
    } catch (error) {
        res.json('Token not valid')
    }
}

exports.sharedProfileData = async function(req, res, next) {
    let isVisitorsProfile = false
    let isFollowing = false
    if (req.session.user) {
        isVisitorsProfile = req.profileUser.data._id.equals(req.session.user._id)
        isFollowing = await Follow.isVisitorFollowing(req.profileUser.data._id, req.visitorId)
    }
    req.isVisitorsProfile = isVisitorsProfile
    req.isFollowing = isFollowing
    let postCountPromise = Post.countPostsByAuthor(req.profileUser.data._id)
    let followerCountPromise = Follow.countFollowersById(req.profileUser.data._id)
    let followingCountPromise = Follow.countFollowingById(req.profileUser.data._id)
    let [postCount, followerCount, followingCount] = await Promise.all([postCountPromise, followerCountPromise, followingCountPromise])

    req.postCount = postCount
    req.followerCount = followerCount
    req.followingCount = followingCount

    next()
}

exports.home = async(req, res) => {
    if (req.session.user) {
        let posts = await Post.getFeed(req.session.user._id)
        res.render('home-dashboard', { posts: posts });
    } else {
        res.render('home-guest', { regError: req.flash('regError') });
    }
};

exports.register = (req, res) => {
    let user = new User(req.body);
    user.register().then(() => {
        req.session.user = { avatar: user.avatar, username: user.data.username, _id: user.data._id }
        req.session.save(() => { res.redirect('/') })
    }).catch((regErrors) => {
        regErrors.forEach((error) => {
            req.flash('regError', error)
        });
        req.session.save(() => { res.redirect('/') })
    })

};

exports.login = (req, res) => {
    let user = new User(req.body);

    user.login()
        .then(result => {
            req.session.user = { avatar: user.avatar, username: user.data.username, _id: user.data._id };
            req.session.save(function() {
                res.redirect('/');
            });
        })
        .catch(err => {
            req.flash('errors', err)
            req.session.save(() => { res.redirect('/') })
        });
};

exports.apiLogin = (req, res) => {
    let user = new User(req.body);

    user.login()
        .then(result => {
            res.json(jwt.sign({ _id: user.data._id }, process.env.JWTSECRET, { expiresIn: '7d' }))
        })
        .catch(err => {
            res.json('Sorry something went wrong')
        });
};

exports.logout = async(req, res) => {
    await req.session.destroy();
    res.redirect('/');
};

exports.ifUserExist = (req, res, next) => {
    User.findByUsername(req.params.username)
        .then((userDocument) => {
            req.profileUser = userDocument
            next()
        })
        .catch(() => {
            res.render('404')
        })
}
exports.profilePostScreen = (req, res) => {
    // console.log('here' + req.profileUser);
    Post.findByAuthorId(req.profileUser.data._id).then((posts) => {
        res.render('profile', {
            currentPage: "posts",
            posts: posts,
            profileUsername: req.profileUser.data.username,
            profileAvatar: req.profileUser.avatar,
            isFollowing: req.isFollowing,
            isVisitorsProfile: req.isVisitorsProfile,
            counts: { postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount }

        })
    }).catch(() => {
        res.render('404')
    })

}

exports.followersProfileScreen = async function(req, res) {
    try {
        let followers = await Follow.getFollowersById(req.profileUser.data._id)

        res.render('profile-followers', {
            currentPage: "followers",
            followers: followers,
            profileUsername: req.profileUser.data.username,
            profileAvatar: req.profileUser.data.avatar,
            isFollowing: req.isFollowing,
            isVisitorsProfile: req.isVisitorsProfile,
            counts: { postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount }

        })
    } catch {
        res.render("404")
    }

}

exports.followingProfileScreen = async function(req, res) {
    try {
        let following = await Follow.getFollowingById(req.profileUser.data._id)

        res.render('profile-following', {
            currentPage: "following",
            following: following,
            profileUsername: req.profileUser.data.username,
            profileAvatar: req.profileUser.data.avatar,
            isFollowing: req.isFollowing,
            isVisitorsProfile: req.isVisitorsProfile,
            counts: { postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount }

        })
    } catch {
        res.render("404")
    }

}

exports.apiGetPostsByUsername = async function(req, res) {
    try {
        let author = User.findByUsername(req.params.username)
        let post = await Post.findByAuthorId(author._id)
        res.json(post)
    } catch (error) {
        res.json('User does not exist')
    }
}